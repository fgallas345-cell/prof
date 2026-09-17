import { useEffect, useMemo, useState } from 'react'
import { adminListProfiles, adminUpdateProfile } from '../lib/repo'
import { Icon, LoadingPage, Modal, Spinner } from '../components/ui'
import { useToast } from '../components/Toast'
import { useAuth } from '../context/AuthContext'
import { PLAN_LABEL, STATUS_LABEL, fmtDateTime, fmtDateShort } from '../lib/utils'

const STATUS_CHIP = { pending: 'warning', active: 'success', suspended: 'danger' }

export default function Admin() {
  const { user } = useAuth()
  const toast = useToast()
  const [rows, setRows] = useState(null)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [edit, setEdit] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = () => adminListProfiles().then(setRows).catch((e) => toast.error(e.message))
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (!rows) return []
    const s = q.trim().toLowerCase()
    return rows.filter((r) =>
      (filter === 'all' || r.status === filter) &&
      (!s || (r.full_name || '').toLowerCase().includes(s) || (r.email || '').toLowerCase().includes(s))
    )
  }, [rows, q, filter])

  const counts = useMemo(() => {
    const c = { all: rows?.length || 0, pending: 0, active: 0, suspended: 0 }
    for (const r of rows || []) c[r.status]++
    return c
  }, [rows])

  const quick = async (r, patch, msg) => {
    setBusy(true)
    try { await adminUpdateProfile(r.id, patch); toast.success(msg); await load() }
    catch (e) { toast.error(e.message) }
    finally { setBusy(false) }
  }

  if (rows === null) return <LoadingPage />

  return (
    <>
      <div className="topbar">
        <div className="grow"><h1>Administration</h1><p className="muted small">Validation des comptes, plans et notes de paiement</p></div>
        <button className="btn ghost icon" onClick={load} aria-label="Rafraîchir"><Icon.Refresh /></button>
      </div>

      <div className="grid-3 mb-2">
        <div className="stat late"><div className="value">{counts.pending}</div><div className="label">En attente</div></div>
        <div className="stat present"><div className="value">{counts.active}</div><div className="label">Validés</div></div>
        <div className="stat absent"><div className="value">{counts.suspended}</div><div className="label">Suspendus</div></div>
      </div>

      <div className="search mb-2">
        <Icon.Search />
        <input placeholder="Rechercher par nom ou email…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="seg fill mb-2">
        {[['all', 'Tous'], ['pending', 'Attente'], ['active', 'Validés'], ['suspended', 'Suspendus']].map(([k, l]) => (
          <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l} · {counts[k]}</button>
        ))}
      </div>

      <div className="list">
        {filtered.length === 0 && <div className="card muted center small">Aucun compte ne correspond.</div>}
        {filtered.map((r) => (
          <div key={r.id} className="card" style={{ padding: 14 }}>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <span className="avatar" style={{ background: r.role === 'admin' ? 'var(--text)' : 'var(--primary)' }}>
                {(r.full_name || r.email || '?').slice(0, 2).toUpperCase()}
              </span>
              <div className="grow">
                <div className="row wrap" style={{ gap: 6 }}>
                  <span className="bold">{r.full_name || <i className="muted">Sans nom</i>}</span>
                  {r.role === 'admin' && <span className="chip neutral">Admin</span>}
                  <span className={`chip ${STATUS_CHIP[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  <span className="chip primary">{PLAN_LABEL[r.plan]}</span>
                </div>
                <div className="small muted">{r.email}</div>
                <div className="xs muted mt-1">
                  Inscrit le {fmtDateShort(r.created_at)} · {r.stats.classes_count ?? 0} classe(s) · {r.stats.students_count ?? 0} élève(s)
                  {r.stats.last_activity && ` · dernier appel ${fmtDateTime(r.stats.last_activity)}`}
                </div>
                {r.payment_note && <div className="xs mt-1" style={{ color: 'var(--primary-text)' }}>📝 {r.payment_note}</div>}
              </div>
            </div>
            {r.id !== user.id && (
              <div className="row wrap mt-2" style={{ gap: 6 }}>
                {r.status !== 'active' && <button className="btn sm success" disabled={busy} onClick={() => quick(r, { status: 'active' }, 'Compte validé')}><Icon.Check size={14} /> Valider</button>}
                {r.status === 'active' && <button className="btn sm danger" disabled={busy} onClick={() => quick(r, { status: 'suspended' }, 'Compte suspendu')}>Suspendre</button>}
                {r.status === 'suspended' && <button className="btn sm secondary" disabled={busy} onClick={() => quick(r, { status: 'active' }, 'Compte réactivé')}>Réactiver</button>}
                <button className="btn sm outline" onClick={() => setEdit(r)}><Icon.Edit size={14} /> Plan & note</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Modifier le compte">
        {edit && <EditForm profile={edit} onCancel={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
      </Modal>
    </>
  )
}

function EditForm({ profile, onCancel, onSaved }) {
  const toast = useToast()
  const [status, setStatus] = useState(profile.status)
  const [plan, setPlan] = useState(profile.plan)
  const [note, setNote] = useState(profile.payment_note || '')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try { await adminUpdateProfile(profile.id, { status, plan, payment_note: note.trim() || null }); toast.success('Compte mis à jour'); onSaved() }
    catch (ex) { toast.error(ex.message) }
    finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit}>
      <p className="small mb-2"><b>{profile.full_name || 'Sans nom'}</b> — {profile.email}</p>
      <div className="grid-2">
        <div className="field">
          <label>Statut</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="pending">En attente</option>
            <option value="active">Validé</option>
            <option value="suspended">Suspendu</option>
          </select>
        </div>
        <div className="field">
          <label>Plan</label>
          <select className="input" value={plan} onChange={(e) => setPlan(e.target.value)}>
            <option value="free">Gratuit</option>
            <option value="monthly">Individuel — mensuel</option>
            <option value="annual">Individuel — annuel</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label>Note interne (paiement, contact…)</label>
        <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. Wave le 12/09 — 5 000 F — renouvellement le 12/10" />
      </div>
      <div className="actions">
        <button type="button" className="btn outline" onClick={onCancel}>Annuler</button>
        <button className="btn" disabled={busy}>{busy ? <Spinner white /> : 'Enregistrer'}</button>
      </div>
    </form>
  )
}
