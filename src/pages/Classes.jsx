import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listClasses, createClass, listAllStudents } from '../lib/repo'
import { Icon, Modal, Empty, Spinner, Illustration, SkeletonList } from '../components/ui'
import { OfflineBanner } from '../components/Layout'
import { useToast } from '../components/Toast'
import { useOnline } from '../lib/online'
import { CLASS_COLORS, randomColor } from '../lib/utils'

export function ClassForm({ initial, onSubmit, onCancel, busy }) {
  const [name, setName] = useState(initial?.name || '')
  const [level, setLevel] = useState(initial?.level || '')
  const [color, setColor] = useState(initial?.color || randomColor())
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name, level, color }) }}>
      <div className="field">
        <label>Nom de la classe *</label>
        <input className="input" autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. CM2 A, 3ème B, Groupe Info…" />
      </div>
      <div className="field">
        <label>Niveau / matière (optionnel)</label>
        <input className="input" value={level} onChange={(e) => setLevel(e.target.value)} placeholder="Ex. Primaire, Mathématiques…" />
      </div>
      <div className="field">
        <label>Couleur</label>
        <div className="row wrap">
          {CLASS_COLORS.map((c) => (
            <button type="button" key={c} onClick={() => setColor(c)}
              style={{ width: 34, height: 34, borderRadius: 10, background: c, outline: color === c ? '3px solid var(--text)' : 'none', outlineOffset: 2 }}
              aria-label={`Couleur ${c}`} />
          ))}
        </div>
      </div>
      <div className="actions">
        <button type="button" className="btn outline" onClick={onCancel}>Annuler</button>
        <button className="btn" disabled={busy || !name.trim()}>{busy ? <Spinner white /> : 'Enregistrer'}</button>
      </div>
    </form>
  )
}

export default function Classes() {
  const { profile } = useAuth()
  const toast = useToast()
  const online = useOnline()
  const nav = useNavigate()
  const [classes, setClasses] = useState(null)
  const [counts, setCounts] = useState({})
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const [cls, students] = await Promise.all([listClasses(), listAllStudents()])
    setClasses(cls)
    const c = {}
    for (const s of students) c[s.class_id] = (c[s.class_id] || 0) + 1
    setCounts(c)
  }
  useEffect(() => { load() }, [])

  const isFree = profile?.plan === 'free'
  const limitReached = isFree && classes && classes.length >= 1

  const create = async (data) => {
    setBusy(true)
    try {
      await createClass(data)
      toast.success('Classe créée')
      setOpen(false)
      await load()
    } catch (e) { toast.error(e.message) }
    finally { setBusy(false) }
  }

  return (
    <>
      <div className="topbar">
        <h1>Mes classes</h1>
        <button className="btn sm" onClick={() => limitReached ? toast.warning('Plan gratuit : 1 classe maximum. Passez au plan individuel.') : setOpen(true)} disabled={!online}>
          <Icon.Plus /> Nouvelle
        </button>
      </div>
      <OfflineBanner />

      {classes === null ? <SkeletonList n={3} /> : classes.length === 0 ? (
        <div className="card">
          <Empty illustration={Illustration.Classroom} title="Aucune classe pour l'instant" text="Créez votre première classe pour commencer à faire l'appel."
            action={<button className="btn" onClick={() => setOpen(true)} disabled={!online}><Icon.Plus /> Créer une classe</button>} />
        </div>
      ) : (
        <div className="list">
          {classes.map((c) => (
            <Link key={c.id} to={`/classes/${c.id}`} className="list-item card-link">
              <span className="avatar" style={{ background: c.color || 'var(--primary)' }}>{c.name.slice(0, 2).toUpperCase()}</span>
              <div className="grow">
                <div className="name">{c.name}</div>
                <div className="muted xs">{counts[c.id] || 0} élève{(counts[c.id] || 0) > 1 ? 's' : ''}{c.level ? ` · ${c.level}` : ''}</div>
              </div>
              <button type="button" className="btn sm secondary" onClick={(e) => { e.preventDefault(); e.stopPropagation(); nav(`/appel/${c.id}`) }}>Appel</button>
              <Icon.ChevronRight size={18} className="arrow" />
            </Link>
          ))}
        </div>
      )}

      {limitReached && (
        <div className="banner info mt-3">
          <Icon.Lock />
          <span>Le plan gratuit est limité à <b>1 classe</b>. <Link to="/reglages" className="bold">Passer au plan individuel</Link> pour des classes illimitées.</span>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nouvelle classe">
        <ClassForm onSubmit={create} onCancel={() => setOpen(false)} busy={busy} />
      </Modal>
    </>
  )
}
