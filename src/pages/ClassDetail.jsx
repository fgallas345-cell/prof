import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getClass, listStudents, addStudents, updateStudent, deleteStudent, updateClass, deleteClass } from '../lib/repo'
import { Icon, Modal, Confirm, Empty, Spinner, TopBar, Illustration, SkeletonList } from '../components/ui'
import { OfflineBanner } from '../components/Layout'
import { useToast } from '../components/Toast'
import { useOnline } from '../lib/online'
import { useAuth } from '../context/AuthContext'
import { initials, sortStudents, fullName } from '../lib/utils'
import { ClassForm } from './Classes'

const VIEW_KEY = 'roster-view'
const readView = () => { try { return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'list' } catch { return 'list' } }

export default function ClassDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const online = useOnline()
  const { profile } = useAuth()
  const [cls, setCls] = useState(null)
  const [students, setStudents] = useState(null)
  const [q, setQ] = useState('')
  const [view, setView] = useState(readView) // 'list' | 'table'
  const [modal, setModal] = useState(null) // 'add' | 'import' | 'edit' | 'editClass' | 'deleteClass' | {delete: student}
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)

  const changeView = (v) => { setView(v); try { localStorage.setItem(VIEW_KEY, v) } catch {} }

  const exportList = async () => {
    if (profile?.plan === 'free') return toast.warning("L'export est réservé au plan individuel.")
    setExporting(true)
    try {
      const { exportClassListPDF } = await import('../lib/export')
      exportClassListPDF({ cls, students, teacherName: profile?.full_name })
      toast.success('Liste PDF générée ✓')
    } catch (e) { toast.error(e.message) }
    finally { setExporting(false) }
  }

  const load = async () => {
    const [c, s] = await Promise.all([getClass(id), listStudents(id)])
    setCls(c); setStudents(sortStudents(s))
  }
  useEffect(() => { load() }, [id])

  const run = async (fn, okMsg) => {
    setBusy(true)
    try { await fn(); if (okMsg) toast.success(okMsg); setModal(null); await load() }
    catch (e) { toast.error(e.message) }
    finally { setBusy(false) }
  }

  if (!cls || students === null) return <SkeletonList n={6} />

  const filtered = q
    ? students.filter((s) => fullName(s).toLowerCase().includes(q.toLowerCase()))
    : students

  return (
    <>
      <TopBar
        title={cls.name}
        subtitle={`${students.length} élève${students.length > 1 ? 's' : ''}${cls.level ? ` · ${cls.level}` : ''}`}
        right={<button className="btn ghost icon" onClick={() => setModal('editClass')} disabled={!online} aria-label="Modifier la classe"><Icon.Edit /></button>}
      />
      <OfflineBanner />

      <div className="grid-2 mb-2">
        <Link to={`/appel/${id}`} className="btn lg"><Icon.Check /> Faire l'appel</Link>
        <Link to={`/historique/${id}`} className="btn lg secondary"><Icon.Calendar /> Historique</Link>
      </div>

      <div className="grid-2 mb-2">
        <button className="btn outline" onClick={() => setModal('add')} disabled={!online}><Icon.Plus /> Ajouter</button>
        <button className="btn outline" onClick={() => setModal('import')} disabled={!online}><Icon.Upload /> Importer</button>
      </div>

      {students.length > 0 && (
        <div className="row between wrap mb-2" style={{ gap: 8 }}>
          <div className="seg">
            <button type="button" className={view === 'list' ? 'on' : ''} onClick={() => changeView('list')} aria-label="Vue liste"><Icon.List size={16} /> Liste</button>
            <button type="button" className={view === 'table' ? 'on' : ''} onClick={() => changeView('table')} aria-label="Vue tableau"><Icon.Table size={16} /> Tableau</button>
          </div>
          <button type="button" className="btn sm secondary" onClick={exportList} disabled={exporting} title="Liste des élèves en PDF, sans les appels">
            {exporting ? <Spinner sm /> : <Icon.File size={16} />} Liste PDF
          </button>
        </div>
      )}

      {students.length > 8 && (
        <div className="search mb-2">
          <Icon.Search />
          <input placeholder="Rechercher un élève…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      )}

      {students.length === 0 ? (
        <div className="card">
          <Empty illustration={Illustration.Students} title="Aucun élève" text="Ajoutez vos élèves un par un ou importez toute la liste depuis un fichier Excel ou CSV." />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card muted center small">Aucun élève ne correspond à « {q} ».</div>
      ) : view === 'table' ? (
        <div className="card flat table-card">
          <div className="table-wrap">
            <table className="table roster">
              <thead>
                <tr><th className="num">N°</th><th>Nom</th><th>Prénom</th><th className="actions"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td className="num muted">{students.indexOf(s) + 1}</td>
                    <td className="bold"><Link to={`/eleve/${s.id}`} style={{ color: 'inherit' }}>{s.last_name}</Link></td>
                    <td><Link to={`/eleve/${s.id}`} style={{ color: 'inherit' }}>{s.first_name}</Link></td>
                    <td className="actions">
                      <button className="btn ghost icon sm" onClick={() => setModal({ edit: s })} disabled={!online} aria-label="Modifier"><Icon.Edit size={16} /></button>
                      <button className="btn ghost icon sm" onClick={() => setModal({ delete: s })} disabled={!online} aria-label="Supprimer" style={{ color: 'var(--danger)' }}><Icon.Trash size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="list">
          {filtered.map((s) => (
            <div key={s.id} className="list-item">
              <Link to={`/eleve/${s.id}`} className="row grow" style={{ color: 'inherit' }}>
                <span className="avatar" style={{ background: cls.color || 'var(--primary)' }}>{initials(s.first_name, s.last_name)}</span>
                <div className="grow">
                  <div className="name">{s.last_name} <span style={{ fontWeight: 500 }}>{s.first_name}</span></div>
                </div>
              </Link>
              <button className="btn ghost icon" onClick={() => setModal({ edit: s })} disabled={!online} aria-label="Modifier"><Icon.Edit size={18} /></button>
              <button className="btn ghost icon" onClick={() => setModal({ delete: s })} disabled={!online} aria-label="Supprimer" style={{ color: 'var(--danger)' }}><Icon.Trash size={18} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="divider mt-3" />
      <button className="btn ghost block" style={{ color: 'var(--danger)' }} onClick={() => setModal('deleteClass')} disabled={!online}>
        <Icon.Trash /> Supprimer cette classe
      </button>

      {/* ---- Modales ---- */}
      <Modal open={modal === 'add'} onClose={() => setModal(null)} title="Ajouter des élèves">
        <AddStudentsForm busy={busy} onCancel={() => setModal(null)}
          onSubmit={(rows) => run(() => addStudents(id, rows), `${rows.length} élève(s) ajouté(s)`)} />
      </Modal>

      <Modal open={modal === 'import'} onClose={() => setModal(null)} title="Importer depuis un fichier">
        <ImportForm busy={busy} onCancel={() => setModal(null)}
          onSubmit={(rows) => run(() => addStudents(id, rows), `${rows.length} élève(s) importé(s)`)} />
      </Modal>

      <Modal open={!!modal?.edit} onClose={() => setModal(null)} title="Modifier l'élève">
        {modal?.edit && (
          <StudentForm initial={modal.edit} busy={busy} onCancel={() => setModal(null)}
            onSubmit={(data) => run(() => updateStudent(modal.edit.id, data), 'Élève modifié')} />
        )}
      </Modal>

      <Modal open={modal === 'editClass'} onClose={() => setModal(null)} title="Modifier la classe">
        <ClassForm initial={cls} busy={busy} onCancel={() => setModal(null)}
          onSubmit={(data) => run(() => updateClass(id, data), 'Classe modifiée')} />
      </Modal>

      <Confirm open={!!modal?.delete} onClose={() => setModal(null)} danger title="Supprimer l'élève"
        message={`Supprimer ${modal?.delete ? fullName(modal.delete) : ''} ? Tout son historique de présence sera effacé.`}
        confirmLabel="Supprimer" onConfirm={() => run(() => deleteStudent(modal.delete.id), 'Élève supprimé')} />

      <Confirm open={modal === 'deleteClass'} onClose={() => setModal(null)} danger title="Supprimer la classe"
        message={`Supprimer la classe « ${cls.name} » ainsi que ses ${students.length} élève(s) et tout l'historique d'appel ? Cette action est irréversible.`}
        confirmLabel="Supprimer définitivement"
        onConfirm={() => run(async () => { await deleteClass(id); nav('/classes') }, 'Classe supprimée')} />
    </>
  )
}

/* ---------------- Ajout rapide : plusieurs lignes "NOM Prénom" ---------------- */
function AddStudentsForm({ onSubmit, onCancel, busy }) {
  const [last, setLast] = useState('')
  const [first, setFirst] = useState('')
  const [bulk, setBulk] = useState('')
  const [mode, setMode] = useState('one')

  const submit = (e) => {
    e.preventDefault()
    if (mode === 'one') {
      if (!last.trim() && !first.trim()) return
      onSubmit([{ last_name: last, first_name: first }])
    } else {
      const rows = bulk.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
        const parts = l.split(/[;,\t]| {2,}/).map((p) => p.trim()).filter(Boolean)
        if (parts.length >= 2) return { last_name: parts[0], first_name: parts.slice(1).join(' ') }
        const words = l.split(/\s+/)
        const upper = words.filter((w) => w === w.toUpperCase() && w.length > 1)
        if (upper.length && upper.length < words.length) return { last_name: upper.join(' '), first_name: words.filter((w) => !upper.includes(w)).join(' ') }
        return { last_name: words[0], first_name: words.slice(1).join(' ') }
      })
      if (rows.length) onSubmit(rows)
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="seg mb-2">
        <button type="button" className={mode === 'one' ? 'on' : ''} onClick={() => setMode('one')}>Un élève</button>
        <button type="button" className={mode === 'bulk' ? 'on' : ''} onClick={() => setMode('bulk')}>Plusieurs d'un coup</button>
      </div>
      {mode === 'one' ? (
        <>
          <div className="field">
            <label>Nom</label>
            <input className="input" autoFocus value={last} onChange={(e) => setLast(e.target.value)} placeholder="DIALLO" autoCapitalize="characters" />
          </div>
          <div className="field">
            <label>Prénom</label>
            <input className="input" value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Aminata" />
          </div>
        </>
      ) : (
        <div className="field">
          <label>Un élève par ligne (NOM Prénom)</label>
          <textarea className="input" rows={8} autoFocus value={bulk} onChange={(e) => setBulk(e.target.value)}
            placeholder={'DIALLO Aminata\nNDIAYE Moussa\nSOW Fatou'} />
          <span className="help">Les mots en MAJUSCULES sont pris comme nom de famille. Vous pouvez aussi séparer par « ; » ou une tabulation.</span>
        </div>
      )}
      <div className="actions">
        <button type="button" className="btn outline" onClick={onCancel}>Annuler</button>
        <button className="btn" disabled={busy}>{busy ? <Spinner white /> : 'Ajouter'}</button>
      </div>
    </form>
  )
}

/* ---------------- Modifier un élève ---------------- */
function StudentForm({ initial, onSubmit, onCancel, busy }) {
  const [last, setLast] = useState(initial.last_name || '')
  const [first, setFirst] = useState(initial.first_name || '')
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ last_name: last.trim(), first_name: first.trim() }) }}>
      <div className="field"><label>Nom</label><input className="input" autoFocus value={last} onChange={(e) => setLast(e.target.value)} /></div>
      <div className="field"><label>Prénom</label><input className="input" value={first} onChange={(e) => setFirst(e.target.value)} /></div>
      <div className="actions">
        <button type="button" className="btn outline" onClick={onCancel}>Annuler</button>
        <button className="btn" disabled={busy}>{busy ? <Spinner white /> : 'Enregistrer'}</button>
      </div>
    </form>
  )
}

/* ---------------- Import CSV / Excel avec aperçu ---------------- */
function ImportForm({ onSubmit, onCancel, busy }) {
  const ref = useRef()
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [fileName, setFileName] = useState('')

  const pick = async (file) => {
    if (!file) return
    setErr(''); setFileName(file.name)
    try {
      const { parseStudentFile } = await import('../lib/export')
      const parsed = await parseStudentFile(file)
      if (!parsed.length) setErr('Aucun élève trouvé dans ce fichier. Vérifiez les colonnes « Nom » et « Prénom ».')
      setRows(parsed)
    } catch { setErr('Impossible de lire ce fichier. Formats acceptés : .xlsx, .xls, .csv') }
  }

  return (
    <div>
      {!rows ? (
        <>
          <div className="locked" onClick={() => ref.current.click()} style={{ cursor: 'pointer' }}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]) }}>
            <div className="icon">📄</div>
            <p className="bold mt-1">Choisir un fichier Excel ou CSV</p>
            <p className="help">Colonnes attendues : <b>Nom</b> et <b>Prénom</b> (ou une seule colonne « NOM Prénom »)</p>
            <input ref={ref} type="file" accept=".csv,.xlsx,.xls,.txt" hidden onChange={(e) => pick(e.target.files[0])} />
          </div>
          {err && <p className="input-error mt-2">{err}</p>}
          <button type="button" className="btn ghost block mt-2" onClick={() => import('../lib/export').then((m) => m.downloadImportTemplate())}><Icon.Download /> Télécharger un modèle Excel</button>
          <div className="actions"><button type="button" className="btn outline" onClick={onCancel}>Annuler</button></div>
        </>
      ) : (
        <>
          <p className="small muted mb-1">{fileName} — <b>{rows.length}</b> élève(s) détecté(s). Vérifiez avant d'importer :</p>
          <div className="card flat table-wrap" style={{ maxHeight: 280, overflow: 'auto', padding: 8 }}>
            <table className="table">
              <thead><tr><th>#</th><th>Nom</th><th>Prénom</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="muted xs">{i + 1}</td>
                    <td><input className="input" style={{ height: 34 }} value={r.last_name} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, last_name: e.target.value } : x))} /></td>
                    <td><input className="input" style={{ height: 34 }} value={r.first_name} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, first_name: e.target.value } : x))} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {err && <p className="input-error mt-2">{err}</p>}
          <div className="actions">
            <button type="button" className="btn outline" onClick={() => setRows(null)}>Autre fichier</button>
            <button type="button" className="btn" disabled={busy || !rows.length} onClick={() => onSubmit(rows)}>
              {busy ? <Spinner white /> : `Importer ${rows.length} élève(s)`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
