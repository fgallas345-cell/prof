import { NavLink, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Icon } from './ui'
import { useAuth } from '../context/AuthContext'
import { useOnline } from '../lib/online'
import { countPending, onSyncChange, syncPending, isSyncing } from '../lib/repo'
import { PLAN_LABEL, initials } from '../lib/utils'

/** Hook : nombre d'appels en attente de synchronisation */
export function usePendingSync() {
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const online = useOnline()
  useEffect(() => {
    let alive = true
    const refresh = async () => {
      const n = await countPending()
      if (alive) { setPending(n); setSyncing(isSyncing()) }
    }
    refresh()
    const off = onSyncChange(refresh)
    const t = setInterval(refresh, 4000)
    return () => { alive = false; off(); clearInterval(t) }
  }, [online])
  return { pending, syncing, sync: () => syncPending() }
}

export function OfflineBanner() {
  const online = useOnline()
  const { pending, syncing } = usePendingSync()
  if (!online) {
    return (
      <div className="banner offline">
        <Icon.WifiOff />
        <span>Mode hors-ligne — vos appels sont enregistrés sur l'appareil{pending ? ` (${pending} en attente)` : ''} et seront synchronisés au retour du réseau.</span>
      </div>
    )
  }
  if (syncing || pending > 0) {
    return (
      <div className="banner sync">
        <Icon.Cloud />
        <span>{syncing ? 'Synchronisation en cours…' : `${pending} enregistrement(s) en attente de synchronisation.`}</span>
      </div>
    )
  }
  return null
}

export default function Layout() {
  const { profile, user } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [first = '', ...rest] = (profile?.full_name || '').split(' ')

  const items = [
    { to: '/', label: 'Accueil', icon: Icon.Home, end: true },
    { to: '/classes', label: 'Classes', icon: Icon.Classes },
    { to: '/historique', label: 'Historique', icon: Icon.Calendar },
    { to: '/exports', label: 'Exports', icon: Icon.Download },
    ...(isAdmin ? [{ to: '/admin', label: 'Admin', icon: Icon.Shield }] : []),
    { to: '/reglages', label: 'Réglages', icon: Icon.Settings },
  ]

  return (
    <div className="shell">
      <nav className="bottomnav">
        <div className="brand">
          <span className="brand-mark"><Icon.Check size={20} /></span>
          Cahier d'appel
        </div>
        {items.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="ico"><it.icon /></span>
            <span>{it.label}</span>
          </NavLink>
        ))}
        <div className="user-block">
          <span className="avatar sm">{initials(first, rest.join(' '))}</span>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="small semi truncate">{profile?.full_name || user?.email}</div>
            <div className="xs muted truncate">{PLAN_LABEL[profile?.plan] || ''}</div>
          </div>
        </div>
      </nav>
      <main className="page">
        <Outlet />
      </main>
    </div>
  )
}
