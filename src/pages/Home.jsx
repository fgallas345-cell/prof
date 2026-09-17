import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listClasses, getTodayDoneMap, getRecentStats, listAllStudents } from '../lib/repo'
import { Icon, Empty, Illustration, Skeleton, SkeletonList } from '../components/ui'
import { OfflineBanner } from '../components/Layout'
import { fmtDate, capitalize, computeStats, todayISO, PLAN_LABEL } from '../lib/utils'

export default function Home() {
  const { profile } = useAuth()
  const [classes, setClasses] = useState(null)
  const [done, setDone] = useState({})
  const [counts, setCounts] = useState({})
  const [stats, setStats] = useState(null)
  const [totalStudents, setTotalStudents] = useState(0)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const cls = await listClasses()
      if (!alive) return
      setClasses(cls)
      const [doneMap, students, recent] = await Promise.all([
        getTodayDoneMap(cls.map((c) => c.id)),
        listAllStudents(),
        getRecentStats(),
      ])
      if (!alive) return
      setDone(doneMap)
      const c = {}
      for (const s of students) c[s.class_id] = (c[s.class_id] || 0) + 1
      setCounts(c)
      setTotalStudents(students.length)
      setStats(computeStats(recent))
    })()
    return () => { alive = false }
  }, [])

  const displayName = (profile?.full_name || '').trim() || 'Enseignant'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'
  const remaining = classes ? classes.filter((c) => !done[c.id]).length : 0
  const nextClass = classes?.find((c) => !done[c.id])

  return (
    <>
      <OfflineBanner />

      {/* Hero */}
      <section className="hero">
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div className="grow">
            <p className="muted small">{capitalize(fmtDate(todayISO()))}</p>
            <h1 style={{ marginTop: 4 }}>{greeting}, {displayName} 👋</h1>
          </div>
          {profile?.plan === 'free' && <span className="chip warning">Plan gratuit</span>}
        </div>
        {classes && classes.length > 0 && (
          <>
            <div className="hero-stats">
              <div className="hero-stat"><div className="v">{classes.length}</div><div className="l">classe{classes.length > 1 ? 's' : ''}</div></div>
              <div className="hero-stat"><div className="v">{totalStudents}</div><div className="l">élève{totalStudents > 1 ? 's' : ''}</div></div>
              <div className="hero-stat"><div className="v">{stats ? `${stats.rate}%` : '–'}</div><div className="l">présence 30 j</div></div>
            </div>
            {nextClass ? (
              <Link to={`/appel/${nextClass.id}`} className="btn lg block mt-2">
                <Icon.Check /> Faire l'appel · {nextClass.name}
              </Link>
            ) : (
              <div className="row mt-2 small semi" style={{ color: 'var(--present-text)' }}>
                <Icon.CheckCircle size={18} /> Tous les appels du jour sont faits.
              </div>
            )}
          </>
        )}
      </section>

      {classes === null ? (
        <div className="mt-3">
          <Skeleton h={18} w={140} style={{ marginBottom: 12 }} />
          <SkeletonList n={3} />
        </div>
      ) : classes.length === 0 ? (
        <div className="card mt-3">
          <Empty
            illustration={Illustration.Classroom}
            title="Bienvenue ! Créez votre première classe"
            text="Ajoutez vos élèves manuellement ou importez-les depuis un fichier Excel/CSV, puis faites l'appel en un clic."
            action={<Link to="/classes" className="btn"><Icon.Plus /> Créer une classe</Link>}
          />
        </div>
      ) : (
        <>
          <div className="section-title">
            <h2>Appel du jour</h2>
            <span className={`chip ${remaining ? 'warning' : 'success'}`}>
              {remaining ? `${remaining} restant${remaining > 1 ? 's' : ''}` : <><Icon.Check /> Tout est fait</>}
            </span>
          </div>
          <div className="list">
            {classes.map((c) => {
              const isDone = !!done[c.id]
              return (
                <Link key={c.id} to={`/appel/${c.id}`} className="list-item card-link">
                  <span className="avatar" style={{ background: c.color || 'var(--primary)' }}>{c.name.slice(0, 2).toUpperCase()}</span>
                  <div className="grow">
                    <div className="name">{c.name}</div>
                    <div className="muted xs">{counts[c.id] || 0} élève{(counts[c.id] || 0) > 1 ? 's' : ''}{c.level ? ` · ${c.level}` : ''}</div>
                  </div>
                  {isDone ? (
                    <span className="chip success"><Icon.Check /> Fait</span>
                  ) : (
                    <span className="chip primary">Faire l'appel</span>
                  )}
                  <Icon.ChevronRight size={18} className="arrow" />
                </Link>
              )
            })}
          </div>

          <div className="section-title">
            <h2>30 derniers jours</h2>
            <Link to="/historique">Voir l'historique →</Link>
          </div>
          {stats && stats.total > 0 ? (
            <>
              <div className="card">
                <div className="row between mb-1">
                  <span className="semi">Taux de présence global</span>
                  <span className="bold" style={{ color: 'var(--present)', fontSize: 22, fontFamily: 'var(--font-display)' }}>{stats.rate}%</span>
                </div>
                <div className="progress"><div style={{ width: `${stats.rate}%` }} /></div>
                <p className="xs muted mt-1">{stats.total} enregistrements sur toutes vos classes</p>
              </div>
              <div className="grid-3 mt-2">
                <div className="stat absent"><div className="value">{stats.absent}</div><div className="label">Absences</div></div>
                <div className="stat late"><div className="value">{stats.late}</div><div className="label">Retards</div></div>
                <div className="stat excused"><div className="value">{stats.excused}</div><div className="label">Excusés</div></div>
              </div>
            </>
          ) : (
            <div className="card muted small center">Aucun appel enregistré ces 30 derniers jours.</div>
          )}
        </>
      )}

      {profile?.plan === 'free' && classes && classes.length > 0 && (
        <div className="banner info mt-3">
          <Icon.Sparkles />
          <span>
            Vous utilisez le <b>{PLAN_LABEL.free}</b> : 1 classe, historique 1 mois, sans export. <Link to="/reglages" className="bold">Passer au plan individuel</Link>
          </span>
        </div>
      )}
    </>
  )
}
