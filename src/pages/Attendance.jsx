import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { addDays, format, parseISO } from 'date-fns'
import { getClass, listStudents, getAttendanceForDay, saveAttendance } from '../lib/repo'
import { Icon, Empty, Spinner, TopBar, Illustration, Skeleton, SkeletonList } from '../components/ui'
import { OfflineBanner } from '../components/Layout'
import { useToast } from '../components/Toast'
import { useOnline } from '../lib/online'
import { useAuth } from '../context/AuthContext'
import { STATUS, STATUS_KEYS, todayISO, fmtDate, capitalize, initials, sortStudents, fmtBirth, duplicateNameIds } from '../lib/utils'

export default function Attendance() {
  const { classId } = useParams()
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const toast = useToast()
  const online = useOnline()
  const { profile } = useAuth()

  const date = params.get('date') || todayISO()
  const setDate = (d) => setParams({ date: d })

  const [cls, setCls] = useState(null)
  const [students, setStudents] = useState(null)
  const [existing, setExisting] = useState({})
  const [marks, setMarks] = useState({})
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [savedAt, setSavedAt] = useState(null)

  useEffect(() => {
    let alive = true
    setStudents(null)
    ;(async () => {
      const [c, s, att] = await Promise.all([getClass(classId), listStudents(classId), getAttendanceForDay(classId, date)])
      if (!alive) return
      setCls(c)
      const sorted = sortStudents(s)
      setStudents(sorted)
      setExisting(att)
      // par défaut : tout le monde présent → l'enseignant ne touche que les exceptions
      const m = {}
      for (const st of sorted) m[st.id] = att[st.id]?.status || 'present'
      setMarks(m)
      setDirty(false)
      const last = Object.values(att).map((r) => r.recorded_at).sort().pop()
      setSavedAt(last || null)
    })()
    return () => { alive = false }
  }, [classId, date])

  const alreadyDone = Object.keys(existing).length > 0
  const isFuture = date > todayISO()
  // Plan gratuit : historique limité à 1 mois → on interdit les corrections plus anciennes
  const tooOld = profile?.plan === 'free' && date < format(addDays(new Date(), -31), 'yyyy-MM-dd')

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, excused: 0 }
    for (const v of Object.values(marks)) c[v]++
    return c
  }, [marks])

  const set = (id, status) => {
    setMarks((m) => ({ ...m, [id]: status }))
    setDirty(true)
    if (navigator.vibrate) navigator.vibrate(8)
  }
  const cycle = (id) => {
    const cur = marks[id] || 'present'
    const next = STATUS_KEYS[(STATUS_KEYS.indexOf(cur) + 1) % STATUS_KEYS.length]
    set(id, next)
  }
  const allPresent = () => { const m = {}; for (const s of students) m[s.id] = 'present'; setMarks(m); setDirty(true) }

  const save = async () => {
    setSaving(true)
    try {
      const entries = students.map((s) => ({ student_id: s.id, status: marks[s.id] || 'present', id: existing[s.id]?.id }))
      await saveAttendance(classId, date, entries)
      setDirty(false)
      setSavedAt(new Date().toISOString())
      const refreshed = await getAttendanceForDay(classId, date)
      setExisting(refreshed)
      toast.success(online ? 'Appel enregistré ✓' : 'Appel enregistré (sera synchronisé) ✓')
      if (date === todayISO()) setTimeout(() => nav('/'), 500)
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  if (!cls || students === null) {
    return (
      <>
        <div className="topbar"><Skeleton h={42} w={42} r={13} /><div className="grow"><Skeleton h={20} w={160} /><Skeleton h={12} w={120} style={{ marginTop: 6 }} /></div></div>
        <Skeleton h={42} r={13} style={{ marginBottom: 16 }} />
        <SkeletonList n={8} h={62} />
      </>
    )
  }
  const presentRate = students.length ? Math.round(((counts.present + counts.late) / students.length) * 100) : 100
  const dupNames = duplicateNameIds(students)

  return (
    <>
      <TopBar
        title={cls.name}
        subtitle={`Prise de présence · ${students.length} élève${students.length > 1 ? 's' : ''}`}
        right={<Link to={`/classes/${classId}`} className="btn ghost icon" aria-label="Gérer la classe"><Icon.Classes /></Link>}
      />
      <OfflineBanner />

      {/* Navigation jour par jour */}
      <div className="row between mb-1">
        <button className="btn outline icon" onClick={() => setDate(format(addDays(parseISO(date), -1), 'yyyy-MM-dd'))} aria-label="Jour précédent"><Icon.ChevronLeft /></button>
        <label className="pill-date" style={{ cursor: 'pointer' }}>
          <Icon.Calendar size={16} />
          <span>{capitalize(fmtDate(date, 'EEE d MMM yyyy'))}</span>
          <input type="date" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Date de l'appel"
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
        </label>
        <button className="btn outline icon" disabled={date >= todayISO()} onClick={() => setDate(format(addDays(parseISO(date), 1), 'yyyy-MM-dd'))} aria-label="Jour suivant"><Icon.ChevronRight /></button>
      </div>
      <div className="center xs muted mb-2">
        {alreadyDone ? <span className="chip success" style={{ height: 22 }}><Icon.Check size={12} /> Appel déjà fait — vous pouvez corriger</span>
          : date === todayISO() ? "Aujourd'hui — pas encore d'appel" : "Pas encore d'appel ce jour"}
      </div>

      {students.length === 0 ? (
        <div className="card">
          <Empty illustration={Illustration.Students} title="Aucun élève dans cette classe" text="Ajoutez d'abord vos élèves."
            action={<Link to={`/classes/${classId}`} className="btn">Gérer les élèves</Link>} />
        </div>
      ) : tooOld ? (
        <div className="locked">
          <div className="icon">🔒</div>
          <p className="bold mt-1">Historique limité à 1 mois en plan gratuit</p>
          <p className="help">Passez au plan individuel pour consulter et corriger tout l'historique.</p>
          <Link to="/reglages" className="btn mt-2">Voir les plans</Link>
        </div>
      ) : (
        <>
          <div className="card row mb-2" style={{ padding: '12px 14px' }}>
            <div className="ring">
              <svg width="52" height="52" viewBox="0 0 52 52">
                <circle className="track" cx="26" cy="26" r="22" />
                <circle className="bar" cx="26" cy="26" r="22" strokeDasharray={2 * Math.PI * 22} strokeDashoffset={2 * Math.PI * 22 * (1 - presentRate / 100)} />
              </svg>
              <div className="txt">{presentRate}%</div>
            </div>
            <div className="grow">
              <div className="status-summary">
                <span className="chip present">{counts.present} présent{counts.present > 1 ? 's' : ''}</span>
                {counts.absent > 0 && <span className="chip absent">{counts.absent} absent{counts.absent > 1 ? 's' : ''}</span>}
                {counts.late > 0 && <span className="chip late">{counts.late} retard{counts.late > 1 ? 's' : ''}</span>}
                {counts.excused > 0 && <span className="chip excused">{counts.excused} excusé{counts.excused > 1 ? 's' : ''}</span>}
              </div>
              <p className="xs muted mt-1">
                Touchez <b>A</b>, <b>R</b> ou <b>E</b> pour signaler une exception.
                {counts.present < students.length && <> · <button type="button" className="xs bold" style={{ color: 'var(--primary)' }} onClick={allPresent}>Tout remettre à présent</button></>}
              </p>
            </div>
          </div>

          <div className="list">
            {students.map((s) => {
              const st = marks[s.id] || 'present'
              return (
                <div key={s.id} className={`att-row ${st}`}>
                  <span className="avatar" style={{ background: STATUS[st].color, cursor: 'pointer' }} onClick={() => cycle(s.id)} title="Changer le statut">
                    {initials(s.first_name, s.last_name)}
                  </span>
                  <div className="who" onClick={() => cycle(s.id)}>
                    <div className="name">{s.last_name} <span style={{ fontWeight: 500 }}>{s.first_name}</span></div>
                    <div className="state" style={{ color: STATUS[st].color }}>
                      {STATUS[st].label}
                      {dupNames.has(s.id) && <span className="muted" style={{ fontWeight: 500 }}> · {s.student_code ? `N° ${s.student_code}` : fmtBirth(s.birth_date) ? `né(e) le ${fmtBirth(s.birth_date)}` : ''}</span>}
                    </div>
                  </div>
                  <div className="att-btns">
                    {STATUS_KEYS.map((k) => (
                      <button key={k} className={`att-btn ${k} ${st === k ? 'on' : ''}`} onClick={() => set(s.id, k)} aria-label={STATUS[k].label} title={STATUS[k].label}>
                        {STATUS[k].short}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="fab-space" />

          <div className="sticky-bar">
            <div className="inner">
              <div className="grow small">
                {dirty ? <span style={{ color: 'var(--late-text)', fontWeight: 600 }}>Modifications non enregistrées</span>
                  : savedAt ? <span className="muted">Enregistré à {format(new Date(savedAt), 'HH:mm')}</span>
                  : <span className="muted">Touchez A / R / E pour les exceptions</span>}
              </div>
              <button className="btn lg" onClick={save} disabled={saving || isFuture} style={{ minWidth: 160 }}>
                {saving ? <Spinner white /> : <><Icon.Check /> {alreadyDone ? 'Mettre à jour' : "Enregistrer l'appel"}</>}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
