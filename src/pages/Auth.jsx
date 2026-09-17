import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Icon, Spinner, PasswordInput, ErrorText } from '../components/ui'
import { STATUS_LABEL } from '../lib/utils'

const Logo = () => (
  <div className="logo">
    <div className="mark"><Icon.Check size={36} /></div>
    <div>
      <h1>Cahier d'appel</h1>
      <p className="muted small">L'appel en quelques secondes, même hors-ligne</p>
    </div>
  </div>
)

/** Panneau gauche (desktop) : proposition de valeur */
const SidePanel = () => (
  <aside className="auth-split">
    <div className="brand-line"><span className="brand-mark"><Icon.Check size={20} /></span> Cahier d'appel</div>
    <div>
      <h1>Faites l'appel en 30 secondes, pas en 5 minutes.</h1>
      <p className="lead">Le cahier d'appel numérique pensé pour les enseignants : simple, rapide, et qui fonctionne même sans connexion.</p>
      <div className="features">
        <div className="feature"><span className="ic"><Icon.Zap size={20} /></span><div><b>Appel en un geste</b><span>Tout le monde est présent par défaut, vous ne touchez que les exceptions.</span></div></div>
        <div className="feature"><span className="ic"><Icon.WifiOff size={20} /></span><div><b>Fonctionne hors-ligne</b><span>Vos appels sont enregistrés sur le téléphone et synchronisés automatiquement.</span></div></div>
        <div className="feature"><span className="ic"><Icon.File size={20} /></span><div><b>Rapports PDF & Excel</b><span>Registre de présence et fiche élève prêts pour le conseil de classe.</span></div></div>
      </div>
    </div>
    <p className="small" style={{ color: 'rgba(255,255,255,0.7)' }}>Conçu pour le primaire, le collège, le lycée et les centres de formation.</p>
  </aside>
)

const Shell = ({ children }) => (
  <div className="auth split-layout">
    <SidePanel />
    <div className="auth-form-side">
      <div className="box">
        <Logo />
        {children}
      </div>
    </div>
  </div>
)

export function Login() {
  const { signIn } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setBusy(true)
    try { await signIn(email.trim(), password); nav('/') }
    catch (ex) { setErr(ex.message) }
    finally { setBusy(false) }
  }

  return (
    <Shell>
      <form className="card" onSubmit={submit}>
        <h2>Connexion</h2>
        <p className="muted small mb-2" style={{ marginTop: 4 }}>Connectez-vous pour faire l'appel.</p>
        <div className="field">
          <label>Email</label>
          <div className="input-wrap">
            <Icon.Mail />
            <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" />
          </div>
        </div>
        <div className="field">
          <label>Mot de passe</label>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
        </div>
        <ErrorText>{err}</ErrorText>
        <button className="btn lg block" disabled={busy}>{busy ? <Spinner white /> : 'Se connecter'}</button>
        <p className="center muted small mt-3">
          Pas encore de compte ? <Link to="/inscription" className="bold">Créer un compte</Link>
        </p>
      </form>
    </Shell>
  )
}

export function Register() {
  const { signUp } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      const data = await signUp(email.trim(), password, fullName.trim())
      if (!data.session) setDone(true)
    } catch (ex) { setErr(ex.message) }
    finally { setBusy(false) }
  }

  if (done) {
    return (
      <Shell>
        <div className="card center">
          <div style={{ fontSize: 44 }}>📩</div>
          <h2 className="mt-1">Vérifiez votre boîte mail</h2>
          <p className="muted mt-1">Un lien de confirmation a été envoyé à <b>{email}</b>. Cliquez dessus puis connectez-vous.</p>
          <Link to="/connexion" className="btn block mt-3">Aller à la connexion</Link>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <form className="card" onSubmit={submit}>
        <h2>Créer mon compte</h2>
        <p className="muted small mb-2" style={{ marginTop: 4 }}>Gratuit pour commencer, activation rapide.</p>
        <div className="field">
          <label>Nom complet</label>
          <div className="input-wrap">
            <Icon.User />
            <input className="input" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ex. Mme Awa Diop" autoComplete="name" />
          </div>
        </div>
        <div className="field">
          <label>Email</label>
          <div className="input-wrap">
            <Icon.Mail />
            <input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" />
          </div>
        </div>
        <div className="field">
          <label>Mot de passe</label>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6 caractères minimum" autoComplete="new-password" minLength={6} />
        </div>
        <ErrorText>{err}</ErrorText>
        <button className="btn lg block" disabled={busy}>{busy ? <Spinner white /> : 'Créer mon compte'}</button>
        <p className="help center mt-2">
          Votre compte sera activé dès confirmation de votre paiement (Wave, Orange Money ou espèces).
        </p>
        <p className="center muted small mt-2">
          Déjà inscrit ? <Link to="/connexion" className="bold">Se connecter</Link>
        </p>
      </form>
    </Shell>
  )
}

/** Écran bloquant : compte en attente de validation ou suspendu */
export function Blocked() {
  const { profile, signOut, refreshProfile, profileLoading, user } = useAuth()
  const suspended = profile?.status === 'suspended'
  return (
    <div className="auth">
      <div className="box">
        <Logo />
        <div className="card center">
          <div style={{ fontSize: 48 }}>{suspended ? '⛔' : '⏳'}</div>
          <h2 className="mt-1">{suspended ? 'Compte suspendu' : 'Compte en attente de validation'}</h2>
          {suspended ? (
            <p className="muted mt-1">Votre accès a été suspendu. Contactez-nous pour régulariser votre abonnement et réactiver votre compte.</p>
          ) : (
            <p className="muted mt-1">
              Merci pour votre inscription, <b>{profile?.full_name || user?.email}</b> !<br />
              Votre compte sera activé dès la confirmation de votre paiement
              (<b>Wave</b>, <b>Orange Money</b> ou <b>espèces</b>). Cela prend généralement quelques heures.
            </p>
          )}
          <div className="chip neutral mt-2">Statut : {STATUS_LABEL[profile?.status] || '…'}</div>
          <div className="col mt-3">
            <button className="btn secondary" onClick={refreshProfile} disabled={profileLoading}>
              {profileLoading ? <Spinner /> : <><Icon.Refresh /> Vérifier mon statut</>}
            </button>
            <button className="btn ghost" onClick={signOut}><Icon.Logout /> Se déconnecter</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Écran affiché si les variables Supabase ne sont pas configurées */
export function NotConfigured() {
  return (
    <div className="auth">
      <div className="box">
        <Logo />
        <div className="card">
          <h2>Configuration requise</h2>
          <p className="muted mt-1">
            L'application n'est pas encore reliée à Supabase. Créez un fichier <span className="kbd">.env</span> à la racine du projet :
          </p>
          <pre className="card flat mt-2 xs" style={{ overflow: 'auto', margin: '12px 0 0' }}>
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...`}
          </pre>
          <p className="help mt-2">Puis exécutez <span className="kbd">supabase/schema.sql</span> dans l'éditeur SQL de Supabase et relancez <span className="kbd">npm run dev</span>.</p>
        </div>
      </div>
    </div>
  )
}
