import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getClass, listStudents, addStudents, updateStudent, deleteStudent, updateClass, deleteClass } from '../lib/repo'
import { Icon, Modal, Confirm, Empty, Spinner, TopBar, Illustration, SkeletonList } from '../components/ui'
import { OfflineBanner } from '../components/Layout'
import { useToast } from '../components/Toast'
import { useOnline } from '../lib/online'
import { useAuth } from '../context/AuthContext'
import { initials, sortStudents, fullName, fmtBirth, studentMeta, toISODate, todayISO, findHomonym, duplicateNameIds } from '../lib/utils'
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
    ? students.filter((s) => `${fullName(s)} ${s.student_code || ''}`.toLowerCase().includes(q.toLowerCase()))
    : students
  const dupNames = duplicateNameIds(students)

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
                <tr><th className="num">N°</th><th>Nom</th><th>Prénom</th><th>Naissance</th><th>Identifiant</th><th className="actions"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td className="num muted">{students.indexOf(s) + 1}</td>
                    <td className="bold"><Link to={`/eleve/${s.id}`} style={{ color: 'inherit' }}>{s.last_name}</Link></td>
                    <td><Link to={`/eleve/${s.id}`} style={{ color: 'inherit' }}>{s.first_name}</Link></td>
                    <td className="nowrap">{fmtBirth(s.birth_date) || <span className="faint">—</span>}</td>
                    <td className="nowrap">{s.student_code || <span className="faint">—</span>}</td>
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
                  <div className="name">{s.last_name} <span style={{ fontWeight: 500 }}>{s.first_name}</span>{dupNames.has(s.id) && <span className="chip warning" style={{ height: 20, marginLeft: 6 }}>homonyme</span>}</div>
                  {studentMeta(s) && <div className="muted xs">{studentMeta(s)}</div>}
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
        <AddStudentsForm busy={busy} onCancel={() => setModal(null)} existing={students}
          onSubmit={(rows) => run(() => addStudents(id, rows), `${rows.length} élève(s) ajouté(s)`)} />
      </Modal>

      <Modal open={modal === 'import'} onClose={() => setModal(null)} title="Importer depuis un fichier">
        <ImportForm busy={busy} onCancel={() => setModal(null)}
          onSubmit={(rows) => run(() => addStudents(id, rows), `${rows.length} élève(s) importé(s)`)} />
      </Modal>

      <Modal open={!!modal?.edit} onClose={() => setModal(null)} title="Modifier l'élève">
        {modal?.edit && (
          <StudentForm initial={modal.edit} busy={busy} onCancel={() => setModal(null)} existing={students}
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

/* ---------------- Champs communs Nom / Prénom / Date de naissance / Identifiant ---------------- */
function StudentFields({ v, set, autoFocus, homonym }) {
  return (
    <>
      <div className="grid-2 fields">
        <div className="field">
          <label>Nom *</label>
          <input className="input" autoFocus={autoFocus} required value={v.last_name} onChange={(e) => set({ last_name: e.target.value })} placeholder="DIALLO" autoCapitalize="characters" />
        </div>
        <div className="field">
          <label>Prénom *</label>
          <input className="input" required value={v.first_name} onChange={(e) => set({ first_name: e.target.value })} placeholder="Aminata" />
        </div>
      </div>
      <div className="grid-2 fields">
        <div className="field">
          <label>Date de naissance *</label>
          <input type="date" className="input" required value={v.birth_date} max={todayISO()} onChange={(e) => set({ birth_date: e.target.value })} />
        </div>
        <div className="field">
          <label>Identifiant / matricule</label>
          <input className="input" value={v.student_code} onChange={(e) => set({ student_code: e.target.value })} placeholder="Optionnel" />
          <span className="help">Utile pour distinguer deux élèves ayant le même nom et la même date de naissance.</span>
        </div>
      </div>
      {homonym && (
        <div className="banner offline" style={{ marginTop: 2 }}>
          <Icon.Alert />
          <span><b>{fullName(homonym)}</b> existe déjà dans cette classe avec la même date de naissance. Renseignez un identifiant différent pour les distinguer.</span>
        </div>
      )}
    </>
  )
}

const EMPTY_STUDENT = { last_name: '', first_name: '', birth_date: '', student_code: '' }

/**
 * Lit une ligne « NOM Prénom » avec, en option, une date de naissance et un identifiant :
 *   DIALLO Aminata ; 12/03/2012 ; A123     (séparateurs acceptés : ; , tabulation ou 2 espaces)
 *   DIALLO Aminata 12/03/2012
 */
function parseStudentLine(line) {
  const out = { ...EMPTY_STUDENT }
  let parts = line.split(/[;,\t]| {2,}/).map((p) => p.trim()).filter(Boolean)
  // date de naissance = premier jeton qui ressemble à une date (dans les colonnes ou dans les mots)
  const isDateTok = (t) => !!toISODate(t) && /\d/.test(t)
  const di = parts.findIndex(isDateTok)
  if (di !== -1) { out.birth_date = toISODate(parts[di]); parts.splice(di, 1) }
  else {
    const words = parts.join(' ').split(/\s+/)
    const wi = words.findIndex(isDateTok)
    if (wi !== -1) { out.birth_date = toISODate(words[wi]); words.splice(wi, 1); parts = [words.join(' ')] }
  }
  const words = (parts[0] || '').split(/\s+/).filter(Boolean)
  const upper = words.filter((w) => w === w.toUpperCase() && w.length > 1 && /\D/.test(w))
  const firstIsFullName = words.length > 1 && upper.length > 0 && upper.length < words.length // ex. « DIALLO Aminata »
  if (parts.length >= 2 && !firstIsFullName) {
    // colonnes : NOM ; Prénom ; identifiant
    out.last_name = parts[0]; out.first_name = parts[1]; out.student_code = parts.slice(2).join(' ')
  } else if (firstIsFullName) {
    // « NOM Prénom » dans le premier bloc (les MAJUSCULES = nom), le reste = identifiant
    out.last_name = upper.join(' '); out.first_name = words.filter((w) => !upper.includes(w)).join(' ')
    out.student_code = parts.slice(1).join(' ')
  } else {
    out.last_name = words[0] || ''; out.first_name = words.slice(1).join(' ')
  }
  return out
}

/* ---------------- Ajout : un élève (formulaire) ou plusieurs lignes ---------------- */
function AddStudentsForm({ onSubmit, onCancel, busy, existing = [] }) {
  const [v, setV] = useState(EMPTY_STUDENT)
  const [bulk, setBulk] = useState('')
  const [mode, setMode] = useState('one')
  const set = (patch) => setV((x) => ({ ...x, ...patch }))
  const homonym = mode === 'one' ? findHomonym(existing, v) : null

  const bulkRows = bulk.split('\n').map((l) => l.trim()).filter(Boolean).map(parseStudentLine)
  const missingDates = bulkRows.filter((r) => !r.birth_date).length

  const submit = (e) => {
    e.preventDefault()
    if (mode === 'one') {
      if (!v.last_name.trim() && !v.first_name.trim()) return
      onSubmit([v])
    } else if (bulkRows.length) onSubmit(bulkRows)
  }

  return (
    <form onSubmit={submit}>
      <div className="seg mb-2">
        <button type="button" className={mode === 'one' ? 'on' : ''} onClick={() => setMode('one')}>Un élève</button>
        <button type="button" className={mode === 'bulk' ? 'on' : ''} onClick={() => setMode('bulk')}>Plusieurs d'un coup</button>
      </div>
      {mode === 'one' ? (
        <StudentFields v={v} set={set} autoFocus homonym={homonym} />
      ) : (
        <div className="field">
          <label>Un élève par ligne : NOM Prénom ; date de naissance ; identifiant</label>
          <textarea className="input" rows={8} autoFocus value={bulk} onChange={(e) => setBulk(e.target.value)}
            placeholder={'DIALLO Aminata ; 12/03/2012 ; A123\nNDIAYE Moussa ; 05/11/2011\nSOW Fatou'} />
          <span className="help">Les mots en MAJUSCULES sont pris comme nom de famille. La date (jj/mm/aaaa) et l'identifiant sont optionnels sur cette ligne — vous pourrez les compléter ensuite.</span>
          {bulkRows.length > 0 && (
            <span className="help">
              <b>{bulkRows.length}</b> élève(s) détecté(s){missingDates ? ` · ${missingDates} sans date de naissance` : ''}.
            </span>
          )}
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
function StudentForm({ initial, onSubmit, onCancel, busy, existing = [] }) {
  const [v, setV] = useState({
    last_name: initial.last_name || '', first_name: initial.first_name || '',
    birth_date: initial.birth_date ? String(initial.birth_date).slice(0, 10) : '', student_code: initial.student_code || '',
  })
  const set = (patch) => setV((x) => ({ ...x, ...patch }))
  const homonym = findHomonym(existing, v, initial.id)
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...v, last_name: v.last_name.trim(), first_name: v.first_name.trim() }) }}>
      <StudentFields v={v} set={set} autoFocus homonym={homonym} />
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
            <p className="help">Colonnes attendues : <b>Nom</b>, <b>Prénom</b>, <b>Date de naissance</b> et <b>Identifiant</b> (optionnel). Une seule colonne « NOM Prénom » est aussi acceptée.</p>
            <input ref={ref} type="file" accept=".csv,.xlsx,.xls,.txt" hidden onChange={(e) => pick(e.target.files[0])} />
          </div>
          {err && <p className="input-error mt-2">{err}</p>}
          <button type="button" className="btn ghost block mt-2" onClick={() => import('../lib/export').then((m) => m.downloadImportTemplate())}><Icon.Download /> Télécharger un modèle Excel</button>
          <div className="actions"><button type="button" className="btn outline" onClick={onCancel}>Annuler</button></div>
        </>
      ) : (
        <>
          <p className="small muted mb-1">
            {fileName} — <b>{rows.length}</b> élève(s) détecté(s)
            {rows.filter((r) => !r.birth_date).length > 0 && <>, <b>{rows.filter((r) => !r.birth_date).length}</b> sans date de naissance</>}. Vérifiez avant d'importer :
          </p>
          <div className="card flat table-wrap" style={{ maxHeight: 280, overflow: 'auto', padding: 8 }}>
            <table className="table">
              <thead><tr><th>#</th><th>Nom</th><th>Prénom</th><th>Naissance</th><th>Identifiant</th></tr></thead>
              <tbody>
                {rows.map((r, i) => {
                  const edit = (k) => (e) => setRows(rows.map((x, j) => j === i ? { ...x, [k]: e.target.value } : x))
                  return (
                    <tr key={i}>
                      <td className="muted xs">{i + 1}</td>
                      <td><input className="input" style={{ height: 34, minWidth: 110 }} value={r.last_name} onChange={edit('last_name')} /></td>
                      <td><input className="input" style={{ height: 34, minWidth: 110 }} value={r.first_name} onChange={edit('first_name')} /></td>
                      <td><input type="date" className="input" style={{ height: 34, minWidth: 140 }} value={r.birth_date || ''} onChange={edit('birth_date')} /></td>
                      <td><input className="input" style={{ height: 34, minWidth: 90 }} value={r.student_code || ''} onChange={edit('student_code')} placeholder="—" /></td>
                    </tr>
                  )
                })}
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
