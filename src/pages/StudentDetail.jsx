import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { format, subMonths } from 'date-fns'
import { getStudent, getClass, getStudentHistory } from '../lib/repo'
import { Icon, LoadingPage, TopBar, StatusChip } from '../components/ui'
import { OfflineBanner } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { computeStats, fmtDate, capitalize, initials, fullName, todayISO } from '../lib/utils'

export default function StudentDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const toast = useToast()
  const [student, setStudent] = useState(null)
  const [cls, setCls] = useState(null)
  const [records, setRecords] = useState(null)
  const [filter, setFilter] = useState('issues') // 'issues' | 'all'

  const isFree = profile?.plan === 'free'
  const from = isFree ? format(subMonths(new Date(), 1), 'yyyy-MM-dd') : null

  useEffect(() => {
    ;(async () => {
      const s = await getStudent(id)
      setStudent(s)
      if (s) {
        const [c, h] = await Promise.all([getClass(s.class_id), getStudentHistory(id, from)])
        setCls(c); setRecords(h)
      }
    })()
  }, [id])

  const stats = useMemo(() => computeStats(records || []), [records])
  const shown = useMemo(() => (records || []).filter((r) => filter === 'all' || r.status !== 'present'), [records, filter])

  if (!student || !cls || records === null) return <LoadingPage />

  const exportSheet = async () => {
    if (isFree) return toast.warning("L'export est réservé au plan individuel.")
    const { exportStudentSheetPDF } = await import('../lib/export')
    const first = records.length ? records[records.length - 1].date : todayISO()
    exportStudentSheetPDF({ student, cls, records, teacherName: profile?.full_name, from: first, to: todayISO() })
  }

  return (
    <>
      <TopBar title={fullName(student)} subtitle={cls.name}
        right={<button className="btn sm secondary" onClick={exportSheet}><Icon.File size={16} /> Fiche PDF</button>} />
      <OfflineBanner />

      <div className="card row" style={{ gap: 14 }}>
        <span className="avatar lg" style={{ background: cls.color }}>{initials(student.first_name, student.last_name)}</span>
        <div className="grow">
          <div className="row between">
            <span className="bold">Taux de présence</span>
            <span className="bold" style={{ fontSize: 22, color: stats.rate >= 90 ? 'var(--present)' : stats.rate >= 70 ? 'var(--late)' : 'var(--absent)' }}>{stats.total ? `${stats.rate}%` : '–'}</span>
          </div>
          <div className="progress mt-1"><div style={{ width: `${stats.rate}%` }} /></div>
          <p className="xs muted mt-1">{stats.total} appel(s){isFree ? ' — 30 derniers jours' : ' au total'}</p>
        </div>
      </div>

      <div className="grid-3 mt-2">
        <div className="stat absent"><div className="value">{stats.absent}</div><div className="label">Absences</div></div>
        <div className="stat late"><div className="value">{stats.late}</div><div className="label">Retards</div></div>
        <div className="stat excused"><div className="value">{stats.excused}</div><div className="label">Excusés</div></div>
      </div>

      <div className="section-title">
        <h2>Chronologie</h2>
        <div className="seg">
          <button className={filter === 'issues' ? 'on' : ''} onClick={() => setFilter('issues')}>Abs. & retards</button>
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>Tout</button>
        </div>
      </div>

      <div className="card">
        {shown.length === 0 ? (
          <p className="muted center small" style={{ padding: 12 }}>
            {filter === 'issues' ? '🎉 Aucune absence ni retard enregistré.' : 'Aucun appel enregistré pour cet élève.'}
          </p>
        ) : (
          <div className="timeline">
            {shown.map((r) => (
              <Link key={r.student_id + r.date} to={`/appel/${r.class_id}?date=${r.date}`} className="timeline-item" style={{ color: 'inherit' }}>
                <div className="grow">
                  <div className="bold small">{capitalize(fmtDate(r.date, 'EEEE d MMMM yyyy'))}</div>
                  {r.note && <div className="xs muted">{r.note}</div>}
                </div>
                <StatusChip status={r.status} />
                <Icon.ChevronRight size={16} style={{ color: 'var(--text-3)' }} />
              </Link>
            ))}
          </div>
        )}
      </div>
      {isFree && <p className="help mt-2 center">Plan gratuit : historique limité aux 30 derniers jours.</p>}
    </>
  )
}
