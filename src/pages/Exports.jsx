import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns'
import { listClasses, listStudents, getAttendanceRange } from '../lib/repo'
import { Icon, Empty, Spinner, Illustration, SkeletonList } from '../components/ui'
import { OfflineBanner } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { todayISO, sortStudents, fullName, PLAN_LABEL } from '../lib/utils'

const iso = (d) => format(d, 'yyyy-MM-dd')
const PRESETS = [
  { key: 'month', label: 'Ce mois', range: () => [iso(startOfMonth(new Date())), todayISO()] },
  { key: 'prev', label: 'Mois dernier', range: () => [iso(startOfMonth(subMonths(new Date(), 1))), iso(endOfMonth(subMonths(new Date(), 1)))] },
  { key: 'term', label: '3 derniers mois', range: () => [iso(startOfMonth(subMonths(new Date(), 2))), todayISO()] },
  { key: 'year', label: 'Depuis janvier', range: () => [iso(startOfYear(new Date())), todayISO()] },
  { key: 'custom', label: 'Personnalisé', range: null },
]

export default function Exports() {
  const { profile } = useAuth()
  const toast = useToast()
  const [classes, setClasses] = useState(null)
  const [classId, setClassId] = useState('')
  const [students, setStudents] = useState([])
  const [studentId, setStudentId] = useState('')
  const [preset, setPreset] = useState('month')
  const [from, setFrom] = useState(PRESETS[0].range()[0])
  const [to, setTo] = useState(todayISO())
  const [busy, setBusy] = useState('')

  const isFree = profile?.plan === 'free'

  useEffect(() => {
    listClasses().then((c) => { setClasses(c); if (c[0]) setClassId(c[0].id) })
  }, [])
  useEffect(() => {
    if (!classId) return
    listStudents(classId).then((s) => { const sorted = sortStudents(s); setStudents(sorted); setStudentId(sorted[0]?.id || '') })
  }, [classId])

  const choosePreset = (k) => {
    setPreset(k)
    const p = PRESETS.find((x) => x.key === k)
    if (p.range) { const [a, b] = p.range(); setFrom(a); setTo(b) }
  }

  const run = async (kind) => {
    if (isFree) return toast.warning("L'export est réservé au plan individuel.")
    const cls = classes.find((c) => c.id === classId)
    if (!cls) return
    if (from > to) return toast.error('La date de début doit précéder la date de fin.')
    setBusy(kind)
    try {
      const [records, { exportClassRegisterPDF, exportClassExcel, exportStudentSheetPDF }] = await Promise.all([getAttendanceRange(classId, from, to), import('../lib/export')])
      if (!records.length) { toast.warning('Aucun appel enregistré sur cette période.'); return }
      if (kind === 'pdf') exportClassRegisterPDF({ cls, students, records, from, to, teacherName: profile?.full_name })
      if (kind === 'xlsx') exportClassExcel({ cls, students, records, from, to })
      if (kind === 'student') {
        const student = students.find((s) => s.id === studentId)
        if (!student) return toast.error('Choisissez un élève.')
        exportStudentSheetPDF({ student, cls, records: records.filter((r) => r.student_id === studentId), teacherName: profile?.full_name, from, to })
      }
      toast.success('Fichier généré ✓')
    } catch (e) { toast.error(e.message) }
    finally { setBusy('') }
  }


  return (
    <>
      <div className="topbar"><h1>Exports & rapports</h1></div>
      <OfflineBanner />

      {isFree && (
        <div className="locked mb-2">
          <div className="icon">🔒</div>
          <p className="bold mt-1">Les exports PDF / Excel sont réservés au plan individuel</p>
          <p className="help">Vous êtes en <b>{PLAN_LABEL.free}</b>. Contactez-nous pour activer votre abonnement (Wave, Orange Money ou espèces).</p>
          <Link to="/reglages" className="btn mt-2">Voir les plans</Link>
        </div>
      )}

      {classes === null ? <SkeletonList n={3} h={120} /> : classes.length === 0 ? (
        <div className="card"><Empty illustration={Illustration.Report} title="Aucune classe" text="Créez une classe et faites l'appel pour pouvoir exporter." action={<Link to="/classes" className="btn">Mes classes</Link>} /></div>
      ) : (
        <>
          <div className="card">
            <h3 className="mb-2">1. Classe et période</h3>
            <div className="field">
              <label>Classe</label>
              <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Période</label>
              <div className="row wrap">
                {PRESETS.map((p) => (
                  <button key={p.key} type="button" className={`btn sm ${preset === p.key ? '' : 'outline'}`} onClick={() => choosePreset(p.key)}>{p.label}</button>
                ))}
              </div>
            </div>
            <div className="grid-2">
              <div className="field"><label>Du</label><input type="date" className="input" value={from} max={to} onChange={(e) => { setFrom(e.target.value); setPreset('custom') }} /></div>
              <div className="field"><label>Au</label><input type="date" className="input" value={to} min={from} max={todayISO()} onChange={(e) => { setTo(e.target.value); setPreset('custom') }} /></div>
            </div>
          </div>

          <div className="card">
            <h3 className="mb-1">2. Registre de la classe</h3>
            <p className="muted small mb-2">Tableau élèves × jours avec code couleur, totaux et taux de présence.</p>
            <div className="grid-2">
              <button className="btn" onClick={() => run('pdf')} disabled={!!busy || isFree}>{busy === 'pdf' ? <Spinner white /> : <><Icon.File /> Registre PDF</>}</button>
              <button className="btn success" onClick={() => run('xlsx')} disabled={!!busy || isFree}>{busy === 'xlsx' ? <Spinner white /> : <><Icon.Download /> Données Excel</>}</button>
            </div>
          </div>

          <div className="card">
            <h3 className="mb-1">3. Fiche individuelle</h3>
            <p className="muted small mb-2">Récapitulatif d'un élève avec ses absences et retards, prêt à signer (réunion parents, conseil de classe).</p>
            <div className="field">
              <label>Élève</label>
              <select className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                {students.map((s) => <option key={s.id} value={s.id}>{fullName(s)}</option>)}
              </select>
            </div>
            <button className="btn secondary block" onClick={() => run('student')} disabled={!!busy || isFree || !studentId}>{busy === 'student' ? <Spinner /> : <><Icon.User /> Générer la fiche PDF</>}</button>
          </div>
        </>
      )}
    </>
  )
}
