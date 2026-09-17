import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { addMonths, format, getDay, getDaysInMonth, startOfMonth, subMonths, isSameMonth } from 'date-fns'
import { fr } from 'date-fns/locale'
import { listClasses, getClass, listStudents, getAttendanceForMonth } from '../lib/repo'
import { Icon, LoadingPage, Empty, TopBar, Illustration, SkeletonList } from '../components/ui'
import { OfflineBanner } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { computeStats, dayTone, todayISO, sortStudents, initials, capitalize, fullName } from '../lib/utils'

/** Sélecteur de classe (si aucun id dans l'URL) */
export function HistoryIndex() {
  const [classes, setClasses] = useState(null)
  useEffect(() => { listClasses().then(setClasses) }, [])
  return (
    <>
      <div className="topbar"><h1>Historique</h1></div>
      <OfflineBanner />
      {classes === null ? <SkeletonList n={3} /> : classes.length === 0 ? (
        <div className="card"><Empty illustration={Illustration.Calendar} title="Aucune classe" text="Créez une classe pour consulter son historique." action={<Link to="/classes" className="btn">Mes classes</Link>} /></div>
      ) : (
        <>
          <p className="muted small mb-2">Choisissez une classe pour voir son calendrier de présence.</p>
          <div className="list">
            {classes.map((c) => (
              <Link key={c.id} to={`/historique/${c.id}`} className="list-item card-link">
                <span className="avatar" style={{ background: c.color || 'var(--primary)' }}>{c.name.slice(0, 2).toUpperCase()}</span>
                <div className="grow"><div className="name">{c.name}</div>{c.level && <div className="muted xs">{c.level}</div>}</div>
                <Icon.ChevronRight size={18} className="arrow" />
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  )
}

/** Calendrier mensuel d'une classe + classement des élèves */
export default function ClassHistory() {
  const { classId } = useParams()
  const nav = useNavigate()
  const { profile } = useAuth()
  const [cls, setCls] = useState(null)
  const [students, setStudents] = useState([])
  const [month, setMonth] = useState(startOfMonth(new Date()))
  const [records, setRecords] = useState(null)
  const [tab, setTab] = useState('cal')

  useEffect(() => {
    Promise.all([getClass(classId), listStudents(classId)]).then(([c, s]) => { setCls(c); setStudents(sortStudents(s)) })
  }, [classId])

  useEffect(() => {
    setRecords(null)
    getAttendanceForMonth(classId, month).then(setRecords)
  }, [classId, month])

  const isFree = profile?.plan === 'free'
  const minMonth = startOfMonth(subMonths(new Date(), 1))
  const lockedMonth = isFree && month < minMonth

  const byDay = useMemo(() => {
    const m = {}
    for (const r of records || []) (m[r.date] ||= []).push(r)
    return m
  }, [records])

  const monthStats = useMemo(() => computeStats(records || []), [records])
  const daysDone = Object.keys(byDay).length

  const perStudent = useMemo(() => {
    return students.map((s) => ({ s, st: computeStats((records || []).filter((r) => r.student_id === s.id)) }))
      .sort((a, b) => (b.st.absent + b.st.late) - (a.st.absent + a.st.late))
  }, [students, records])

  if (!cls) return <LoadingPage />

  const nDays = getDaysInMonth(month)
  const offset = (getDay(month) + 6) % 7 // lundi = 0
  const cells = [...Array(offset).fill(null), ...Array.from({ length: nDays }, (_, i) => i + 1)]
  const today = todayISO()

  return (
    <>
      <TopBar title={cls.name} subtitle="Historique de présence"
        right={<Link to={`/appel/${classId}`} className="btn sm secondary"><Icon.Check size={16} /> Appel</Link>} />
      <OfflineBanner />

      {/* Navigation mois */}
      <div className="row between mb-2">
        <button className="btn outline icon" onClick={() => setMonth(subMonths(month, 1))} aria-label="Mois précédent"><Icon.ChevronLeft /></button>
        <h2 style={{ textTransform: 'capitalize' }}>{format(month, 'MMMM yyyy', { locale: fr })}</h2>
        <button className="btn outline icon" disabled={isSameMonth(month, new Date())} onClick={() => setMonth(addMonths(month, 1))} aria-label="Mois suivant"><Icon.ChevronRight /></button>
      </div>

      {lockedMonth ? (
        <div className="locked">
          <div className="icon">🔒</div>
          <p className="bold mt-1">Historique limité à 1 mois en plan gratuit</p>
          <p className="help">Passez au plan individuel pour accéder à tout votre historique.</p>
          <Link to="/reglages" className="btn mt-2">Voir les plans</Link>
        </div>
      ) : records === null ? <LoadingPage /> : (
        <>
          <div className="grid-3 mb-2">
            <div className="stat primary"><div className="value">{daysDone}</div><div className="label">Appels ce mois</div></div>
            <div className="stat present"><div className="value">{monthStats.rate}%</div><div className="label">Présence</div></div>
            <div className="stat absent"><div className="value">{monthStats.absent}</div><div className="label">Absences</div></div>
          </div>

          <div className="seg mb-2">
            <button className={tab === 'cal' ? 'on' : ''} onClick={() => setTab('cal')}>Calendrier</button>
            <button className={tab === 'students' ? 'on' : ''} onClick={() => setTab('students')}>Par élève</button>
          </div>

          {tab === 'cal' ? (
            <div className="card">
              <div className="cal-head">{['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'].map((d) => <div key={d}>{d}</div>)}</div>
              <div className="cal-grid">
                {cells.map((d, i) => {
                  if (!d) return <div key={`e${i}`} className="cal-day empty" />
                  const iso = format(new Date(month.getFullYear(), month.getMonth(), d), 'yyyy-MM-dd')
                  const recs = byDay[iso]
                  const st = recs ? computeStats(recs) : null
                  const cls2 = recs ? `has ${dayTone(st.rate)}` : iso <= today ? 'none' : ''
                  return (
                    <div key={iso} className={`cal-day ${cls2} ${iso === today ? 'today' : ''}`}
                      onClick={() => iso <= today && nav(`/appel/${classId}?date=${iso}`)}
                      title={recs ? `${st.rate}% de présence · ${st.absent} abs.` : 'Aucun appel'}>
                      <span>{d}</span>
                      {recs && <span className="sub">{st.absent + st.late > 0 ? `${st.absent + st.late} ✗` : '✓'}</span>}
                    </div>
                  )
                })}
              </div>
              <div className="legend mt-2">
                <span><i className="dot" style={{ background: 'var(--present)' }} /> ≥ 90 %</span>
                <span><i className="dot" style={{ background: 'var(--late)' }} /> 70–89 %</span>
                <span><i className="dot" style={{ background: 'var(--absent)' }} /> &lt; 70 %</span>
                <span><i className="dot" style={{ background: 'var(--border)' }} /> pas d'appel</span>
              </div>
              <p className="help mt-1">Touchez un jour pour voir ou corriger l'appel.</p>
            </div>
          ) : (
            <div className="list">
              {perStudent.length === 0 && <div className="card"><Empty illustration={Illustration.Students} title="Aucun élève" /></div>}
              {perStudent.map(({ s, st }) => (
                <Link key={s.id} to={`/eleve/${s.id}`} className="list-item card-link">
                  <span className="avatar" style={{ background: cls.color }}>{initials(s.first_name, s.last_name)}</span>
                  <div className="grow">
                    <div className="name">{fullName(s)}</div>
                    <div className="row xs" style={{ gap: 6 }}>
                      {st.absent > 0 && <span className="chip absent" style={{ height: 20 }}>{st.absent} abs.</span>}
                      {st.late > 0 && <span className="chip late" style={{ height: 20 }}>{st.late} ret.</span>}
                      {st.excused > 0 && <span className="chip excused" style={{ height: 20 }}>{st.excused} exc.</span>}
                      {st.absent + st.late + st.excused === 0 && <span className="muted">Aucune absence</span>}
                    </div>
                  </div>
                  <div className="bold" style={{ color: st.rate >= 90 ? 'var(--present)' : st.rate >= 70 ? 'var(--late)' : 'var(--absent)' }}>{st.total ? `${st.rate}%` : '–'}</div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}
