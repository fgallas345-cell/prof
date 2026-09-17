import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getProfile, setCurrentTeacher, syncPending } from '../lib/repo'
import { clearLocalData } from '../lib/db'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = chargement
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); return }
    setProfileLoading(true)
    try {
      const p = await getProfile(userId)
      setProfile(p)
    } catch {
      // hors-ligne : on conserve le profil en cache
      try {
        const cached = localStorage.getItem('profile:' + userId)
        if (cached) setProfile(JSON.parse(cached))
      } catch { /* ignore */ }
    } finally {
      setProfileLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!supabase) { setSession(null); return }
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const id = session?.user?.id || null
    setCurrentTeacher(id)
    loadProfile(id)
    if (id) syncPending().catch(() => {})
  }, [session, loadProfile])

  useEffect(() => {
    if (profile?.id) {
      try { localStorage.setItem('profile:' + profile.id, JSON.stringify(profile)) } catch { /* ignore */ }
    }
  }, [profile])

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(translateAuthError(error.message))
  }

  const signUp = async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } },
    })
    if (error) throw new Error(translateAuthError(error.message))
    return data
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    await clearLocalData()
    setProfile(null)
  }

  const refreshProfile = () => loadProfile(session?.user?.id)

  return (
    <AuthCtx.Provider value={{ session, user: session?.user ?? null, profile, profileLoading, signIn, signUp, signOut, refreshProfile, setProfile }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)

function translateAuthError(msg = '') {
  const m = msg.toLowerCase()
  if (m.includes('invalid login')) return 'Email ou mot de passe incorrect.'
  if (m.includes('already registered') || m.includes('already been registered')) return 'Un compte existe déjà avec cet email.'
  if (m.includes('password should be')) return 'Le mot de passe doit contenir au moins 6 caractères.'
  if (m.includes('email not confirmed')) return "Veuillez confirmer votre email avant de vous connecter."
  if (m.includes('email rate limit')) return "Limite d'envoi d'emails atteinte côté serveur. Réessayez dans une heure, ou contactez-nous pour activer votre compte directement."
  if (m.includes('rate limit')) return 'Trop de tentatives. Réessayez dans quelques minutes.'
  if (m.includes('network') || m.includes('fetch')) return 'Connexion impossible. Vérifiez votre accès internet.'
  return msg
}
