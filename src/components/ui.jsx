import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/* ---------------- Icônes (inline SVG, stroke) ---------------- */
const I = ({ children, size = 20, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...rest}>
    {children}
  </svg>
)
export const Icon = {
  Home: (p) => <I {...p}><path d="m3 11 9-8 9 8v9a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2z" /></I>,
  Classes: (p) => <I {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></I>,
  Check: (p) => <I {...p}><path d="M20 6 9 17l-5-5" /></I>,
  CheckCircle: (p) => <I {...p}><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></I>,
  Calendar: (p) => <I {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></I>,
  Chart: (p) => <I {...p}><path d="M3 3v18h18" /><path d="M18 17V9M13 17V5M8 17v-3" /></I>,
  Download: (p) => <I {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></I>,
  Settings: (p) => <I {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></I>,
  Shield: (p) => <I {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></I>,
  Back: (p) => <I {...p}><path d="m15 18-6-6 6-6" /></I>,
  Plus: (p) => <I {...p}><path d="M12 5v14M5 12h14" /></I>,
  Search: (p) => <I {...p}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></I>,
  Trash: (p) => <I {...p}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></I>,
  Edit: (p) => <I {...p}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></I>,
  Upload: (p) => <I {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></I>,
  Wifi: (p) => <I {...p}><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" /></I>,
  WifiOff: (p) => <I {...p}><path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" /></I>,
  Refresh: (p) => <I {...p}><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 16h5v5" /></I>,
  ChevronRight: (p) => <I {...p}><path d="m9 18 6-6-6-6" /></I>,
  ChevronLeft: (p) => <I {...p}><path d="m15 18-6-6 6-6" /></I>,
  User: (p) => <I {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></I>,
  Logout: (p) => <I {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></I>,
  Lock: (p) => <I {...p}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></I>,
  Clock: (p) => <I {...p}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></I>,
  Star: (p) => <I {...p}><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" /></I>,
  File: (p) => <I {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></I>,
  Smartphone: (p) => <I {...p}><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" /></I>,
  Info: (p) => <I {...p}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></I>,
  X: (p) => <I {...p}><path d="M18 6 6 18M6 6l12 12" /></I>,
  Cloud: (p) => <I {...p}><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z" /></I>,
  Eye: (p) => <I {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></I>,
  EyeOff: (p) => <I {...p}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" /></I>,
  Mail: (p) => <I {...p}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 7L2 7" /></I>,
  Zap: (p) => <I {...p}><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></I>,
  Sparkles: (p) => <I {...p}><path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z" /></I>,
  Alert: (p) => <I {...p}><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></I>,
  List: (p) => <I {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></I>,
  Table: (p) => <I {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 15h18M9 4v16" /></I>,
}

/* ---------------- Illustrations (états vides) ---------------- */
export const Illustration = {
  Classroom: () => (
    <svg className="illu" viewBox="0 0 120 120" fill="none">
      <circle cx="60" cy="60" r="56" fill="var(--primary-soft)" />
      <rect x="28" y="40" width="64" height="44" rx="8" fill="var(--surface)" stroke="var(--primary-soft-2)" strokeWidth="2" />
      <rect x="36" y="50" width="30" height="5" rx="2.5" fill="var(--primary-soft-2)" />
      <rect x="36" y="60" width="44" height="5" rx="2.5" fill="var(--primary-soft-2)" />
      <rect x="36" y="70" width="22" height="5" rx="2.5" fill="var(--primary-soft-2)" />
      <circle cx="84" cy="44" r="12" fill="var(--primary)" />
      <path d="M78 44h12M84 38v12" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),
  Students: () => (
    <svg className="illu" viewBox="0 0 120 120" fill="none">
      <circle cx="60" cy="60" r="56" fill="var(--primary-soft)" />
      <circle cx="46" cy="50" r="11" fill="var(--primary)" />
      <path d="M26 86c0-11 9-19 20-19s20 8 20 19" fill="var(--primary)" />
      <circle cx="76" cy="52" r="9" fill="var(--primary-2)" opacity="0.8" />
      <path d="M62 84c0-8 6-15 14-15s14 7 14 15" fill="var(--primary-2)" opacity="0.8" />
    </svg>
  ),
  Calendar: () => (
    <svg className="illu" viewBox="0 0 120 120" fill="none">
      <circle cx="60" cy="60" r="56" fill="var(--primary-soft)" />
      <rect x="30" y="34" width="60" height="54" rx="10" fill="var(--surface)" stroke="var(--primary-soft-2)" strokeWidth="2" />
      <rect x="30" y="34" width="60" height="16" rx="10" fill="var(--primary)" />
      <rect x="30" y="42" width="60" height="8" fill="var(--primary)" />
      {[0,1,2,3].map((i) => [0,1].map((j) => <rect key={i+'-'+j} x={38+i*13} y={56+j*13} width="9" height="9" rx="2.5" fill={(i+j)%3===0 ? 'var(--present)' : 'var(--primary-soft-2)'} />))}
    </svg>
  ),
  Report: () => (
    <svg className="illu" viewBox="0 0 120 120" fill="none">
      <circle cx="60" cy="60" r="56" fill="var(--primary-soft)" />
      <rect x="34" y="28" width="52" height="64" rx="8" fill="var(--surface)" stroke="var(--primary-soft-2)" strokeWidth="2" />
      <rect x="44" y="64" width="8" height="16" rx="2" fill="var(--excused)" />
      <rect x="56" y="52" width="8" height="28" rx="2" fill="var(--present)" />
      <rect x="68" y="58" width="8" height="22" rx="2" fill="var(--late)" />
      <rect x="44" y="38" width="32" height="5" rx="2.5" fill="var(--primary-soft-2)" />
    </svg>
  ),
}

/* ---------------- Squelettes de chargement ---------------- */
export const Skeleton = ({ h = 16, w = '100%', r = 12, style }) => <div className="skeleton" style={{ height: h, width: w, borderRadius: r, ...style }} />
export const SkeletonList = ({ n = 4, h = 66 }) => (
  <div className="list">{Array.from({ length: n }, (_, i) => <Skeleton key={i} h={h} r={16} />)}</div>
)

/* ---------------- Champ mot de passe ---------------- */
export function PasswordInput({ value, onChange, placeholder, autoComplete, minLength }) {
  const [show, setShow] = useState(false)
  return (
    <div className="input-wrap">
      <Icon.Lock />
      <input className="input" type={show ? 'text' : 'password'} required minLength={minLength} autoComplete={autoComplete} value={value} onChange={onChange} placeholder={placeholder} style={{ paddingRight: 46 }} />
      <button type="button" className="btn ghost icon sm eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Masquer' : 'Afficher'}>
        {show ? <Icon.EyeOff size={18} /> : <Icon.Eye size={18} />}
      </button>
    </div>
  )
}

/* ---------------- Spinner ---------------- */
export const Spinner = ({ white, sm }) => <div className={`spinner ${white ? 'white' : ''} ${sm ? 'sm' : ''}`} />
export const LoadingPage = () => <div className="loading-page"><Spinner /></div>
export const ErrorText = ({ children }) => children ? <p className="input-error mb-2"><Icon.Alert size={16} /> {children}</p> : null

/* ---------------- Modal (bottom sheet mobile / centré desktop) ---------------- */
export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`sheet ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        {title && (
          <div className="row between mb-2">
            <h2 style={{ margin: 0 }}>{title}</h2>
            <button className="btn ghost icon" onClick={onClose} aria-label="Fermer"><Icon.X /></button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

/* ---------------- Confirmation ---------------- */
export function Confirm({ open, onClose, onConfirm, title = 'Confirmer', message, confirmLabel = 'Confirmer', danger }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="muted">{message}</p>
      <div className="actions">
        <button className="btn outline" onClick={onClose}>Annuler</button>
        <button className={`btn ${danger ? 'danger' : ''}`} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  )
}

/* ---------------- Empty state ---------------- */
export const Empty = ({ icon = '📭', illustration: Illu, title, text, action }) => (
  <div className="empty">
    {Illu ? <Illu /> : <div className="icon">{icon}</div>}
    <h3>{title}</h3>
    {text && <p className="small">{text}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
)

/* ---------------- Barre de titre avec retour ---------------- */
export function TopBar({ title, subtitle, back = true, right }) {
  const nav = useNavigate()
  return (
    <div className="topbar">
      {back && (
        <button className="back" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/'))} aria-label="Retour">
          <Icon.Back />
        </button>
      )}
      <div className="grow">
        <h1 className="clamp-2" style={{ fontSize: 20 }}>{title}</h1>
        {subtitle && <div className="muted small">{subtitle}</div>}
      </div>
      {right}
    </div>
  )
}

/* ---------------- Chip statut ---------------- */
export const StatusChip = ({ status }) => {
  const map = { present: 'Présent', absent: 'Absent', late: 'Retard', excused: 'Excusé' }
  return <span className={`chip ${status}`}>{map[status] || status}</span>
}
