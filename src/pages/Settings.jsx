import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { updateProfile } from '../lib/repo'
import { db } from '../lib/db'
import { Icon, Spinner, Confirm } from '../components/ui'
import { OfflineBanner, usePendingSync } from '../components/Layout'
import { useToast } from '../components/Toast'
import { useOnline } from '../lib/online'
import { PLAN_LABEL, STATUS_LABEL, fmtDateTime } from '../lib/utils'

/** Hook : invite d'installation PWA (Android/Chrome) */
function useInstallPrompt() {
  const [evt, setEvt] = useState(null)
  const [installed, setInstalled] = useState(window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)
  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setEvt(e) }
    const onInstalled = () => { setInstalled(true); setEvt(null) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled) }
  }, [])
  const install = async () => { if (!evt) return; evt.prompt(); await evt.userChoice; setEvt(null) }
  return { canInstall: !!evt, installed, install }
}

export default function Settings() {
  const { profile, user, signOut, setProfile } = useAuth()
  const toast = useToast()
  const online = useOnline()
  const { pending, syncing, sync } = usePendingSync()
  const { canInstall, installed, install } = useInstallPrompt()
  const [name, setName] = useState(profile?.full_name || '')
  const [busy, setBusy] = useState(false)
  const [lastSync, setLastSync] = useState(null)
  const [confirmOut, setConfirmOut] = useState(false)

  useEffect(() => { db.meta.get('lastSync').then((m) => setLastSync(m?.value || null)) }, [pending, syncing])

  const saveName = async (e) => {
    e.preventDefault()
    setBusy(true)
    try { const p = await updateProfile(user.id, { full_name: name.trim() }); setProfile(p); toast.success('Profil mis à jour') }
    catch (ex) { toast.error(ex.message) }
    finally { setBusy(false) }
  }

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)

  return (
    <>
      <div className="topbar"><h1>Réglages</h1></div>
      <OfflineBanner />

      {/* Profil */}
      <form className="card" onSubmit={saveName}>
        <h3 className="mb-2">Mon profil</h3>
        <div className="field"><label>Nom complet</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label>Email</label><input className="input" value={user?.email || ''} disabled /></div>
        <button className="btn secondary" disabled={busy || !online || name.trim() === (profile?.full_name || '')}>{busy ? <Spinner /> : 'Enregistrer'}</button>
      </form>

      {/* Abonnement */}
      <div className="card">
        <div className="row between mb-1">
          <h3>Mon abonnement</h3>
          <span className={`chip ${profile?.plan === 'free' ? 'warning' : 'success'}`}>{PLAN_LABEL[profile?.plan] || '…'}</span>
        </div>
        <p className="small muted">Statut du compte : <b>{STATUS_LABEL[profile?.status]}</b></p>
        <div className="divider" />
        <div className="col">
          <PlanRow name="Gratuit" desc="1 classe · historique 1 mois · sans export" active={profile?.plan === 'free'} />
          <PlanRow name="Individuel — mensuel" desc="Classes illimitées · historique complet · exports PDF/Excel" active={profile?.plan === 'monthly'} />
          <PlanRow name="Individuel — annuel" desc="Identique au mensuel, tarif réduit sur l'année scolaire" active={profile?.plan === 'annual'} />
        </div>
        {profile?.plan === 'free' && (
          <div className="banner info mt-2" style={{ marginBottom: 0 }}>
            <Icon.Info />
            <span>Pour passer au plan individuel : contactez-nous, réglez par <b>Wave</b>, <b>Orange Money</b> ou <b>espèces</b>, et votre plan est activé manuellement.</span>
          </div>
        )}
      </div>

      {/* Synchronisation */}
      <div className="card">
        <h3 className="mb-1">Synchronisation hors-ligne</h3>
        <p className="small muted">Vos appels sont enregistrés sur l'appareil puis envoyés automatiquement au serveur dès que la connexion est disponible.</p>
        <div className="row between mt-2">
          <div>
            <div className="small"><span className={`dot`} style={{ background: online ? 'var(--present)' : 'var(--late)', marginRight: 6 }} />{online ? 'En ligne' : 'Hors-ligne'}</div>
            <div className="xs muted">{pending ? `${pending} enregistrement(s) en attente` : 'Tout est synchronisé'}{lastSync ? ` · dernière synchro ${fmtDateTime(lastSync)}` : ''}</div>
          </div>
          <button className="btn sm outline" onClick={() => sync().then((r) => toast.success(r?.pushed ? `${r.pushed} envoyé(s)` : 'Déjà à jour')).catch((e) => toast.error(e.message))} disabled={!online || syncing}>
            {syncing ? <Spinner sm /> : <Icon.Refresh size={16} />} Synchroniser
          </button>
        </div>
      </div>

      {/* Installation */}
      <div className="card">
        <h3 className="mb-1"><Icon.Smartphone size={18} style={{ verticalAlign: -3 }} /> Installer l'application</h3>
        {installed ? (
          <p className="small muted">✅ L'application est installée sur cet appareil.</p>
        ) : canInstall ? (
          <>
            <p className="small muted mb-2">Ajoutez Cahier d'appel à votre écran d'accueil pour l'ouvrir comme une vraie application.</p>
            <button className="btn" onClick={install}><Icon.Download /> Installer sur l'appareil</button>
          </>
        ) : isIOS ? (
          <p className="small muted">Sur iPhone / iPad : touchez le bouton <b>Partager</b> (carré avec flèche) dans Safari puis <b>« Sur l'écran d'accueil »</b>.</p>
        ) : (
          <p className="small muted">Dans le menu de votre navigateur (⋮), choisissez <b>« Installer l'application »</b> ou <b>« Ajouter à l'écran d'accueil »</b>.</p>
        )}
      </div>

      <button className="btn ghost block mt-2" style={{ color: 'var(--danger)' }} onClick={() => setConfirmOut(true)}><Icon.Logout /> Se déconnecter</button>
      <p className="help center mt-2">Cahier d'appel · v1.1</p>

      <Confirm open={confirmOut} onClose={() => setConfirmOut(false)} title="Se déconnecter"
        message={pending ? `Attention : ${pending} appel(s) ne sont pas encore synchronisés et seront perdus si vous vous déconnectez maintenant.` : 'Voulez-vous vraiment vous déconnecter ?'}
        confirmLabel="Se déconnecter" danger={pending > 0} onConfirm={signOut} />
    </>
  )
}

const PlanRow = ({ name, desc, active }) => (
  <div className={`plan-row ${active ? 'active' : ''}`}>
    <div className="grow">
      <div className="bold small">{name}</div>
      <div className="xs muted">{desc}</div>
    </div>
    {active && <span className="chip primary">Actuel</span>}
  </div>
)
