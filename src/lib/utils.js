import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

export const STATUS = {
  present: { key: 'present', label: 'Présent', short: 'P', color: '#16a34a' },
  absent:  { key: 'absent',  label: 'Absent',  short: 'A', color: '#dc2626' },
  late:    { key: 'late',    label: 'Retard',  short: 'R', color: '#f59e0b' },
  excused: { key: 'excused', label: 'Excusé',  short: 'E', color: '#0d9488' },
}
export const STATUS_KEYS = ['present', 'absent', 'late', 'excused']

export const todayISO = () => format(new Date(), 'yyyy-MM-dd')

export function fmtDate(iso, pattern = 'EEEE d MMMM yyyy') {
  if (!iso) return ''
  const d = typeof iso === 'string' ? parseISO(iso) : iso
  return format(d, pattern, { locale: fr })
}

export function fmtDateShort(iso) {
  return fmtDate(iso, 'dd/MM/yyyy')
}

export function fmtDateTime(iso) {
  if (!iso) return ''
  return format(new Date(iso), 'dd/MM/yyyy HH:mm', { locale: fr })
}

export const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')

export function initials(first = '', last = '') {
  return `${(first[0] || '').toUpperCase()}${(last[0] || '').toUpperCase()}` || '?'
}

export function fullName(s) {
  return `${s.last_name || ''} ${s.first_name || ''}`.trim()
}

/** Date de naissance au format dd/MM/yyyy ('' si absente) */
export function fmtBirth(iso) {
  return iso ? fmtDate(String(iso).slice(0, 10), 'dd/MM/yyyy') : ''
}

/** Sous-titre d'un élève : « né(e) le 12/03/2012 · N° 1234 » */
export function studentMeta(s) {
  const parts = []
  if (s.birth_date) parts.push(`né(e) le ${fmtBirth(s.birth_date)}`)
  if (s.student_code) parts.push(`N° ${s.student_code}`)
  return parts.join(' · ')
}

/**
 * Convertit une saisie de date (jj/mm/aaaa, jj-mm-aaaa, aaaa-mm-jj, objet Date, numéro de série Excel)
 * en ISO yyyy-MM-dd. Renvoie '' si non reconnue.
 */
export function toISODate(v) {
  if (!v && v !== 0) return ''
  if (v instanceof Date) return isNaN(v) ? '' : format(v, 'yyyy-MM-dd')
  if (typeof v === 'number') {
    // numéro de série Excel (jours depuis le 30/12/1899)
    if (v < 20000 || v > 80000) return ''
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000)
    return d.toISOString().slice(0, 10)
  }
  const str = String(v).trim()
  let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = str.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/)
  if (m) {
    let y = m[3]
    if (y.length === 2) y = (Number(y) > Number(String(new Date().getFullYear()).slice(2)) ? '19' : '20') + y
    const iso = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    return isNaN(parseISO(iso)) ? '' : iso
  }
  return ''
}

/** Ids des élèves qui partagent nom + prénom avec un autre élève de la liste (à distinguer par date / identifiant) */
export function duplicateNameIds(list) {
  const seen = {}
  for (const s of list) (seen[fullName(s).toLowerCase()] ||= []).push(s.id)
  return new Set(Object.values(seen).filter((ids) => ids.length > 1).flat())
}

/** Vrai si un autre élève a le même nom, prénom ET date de naissance (et qu'aucun identifiant ne les distingue) */
export function findHomonym(list, candidate, excludeId = null) {
  const name = fullName(candidate).toLowerCase()
  if (!name) return null
  return list.find((s) =>
    s.id !== excludeId &&
    fullName(s).toLowerCase() === name &&
    (s.birth_date || '') === (candidate.birth_date || '') &&
    !(candidate.student_code && s.student_code && candidate.student_code !== s.student_code)
  ) || null
}

export function sortStudents(list) {
  return [...list].sort((a, b) =>
    (a.last_name || '').localeCompare(b.last_name || '', 'fr', { sensitivity: 'base' }) ||
    (a.first_name || '').localeCompare(b.first_name || '', 'fr', { sensitivity: 'base' })
  )
}

export const uuid = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
      })

// Statistiques à partir d'une liste d'enregistrements
export function computeStats(records) {
  const s = { total: records.length, present: 0, absent: 0, late: 0, excused: 0, rate: 100 }
  for (const r of records) s[r.status] = (s[r.status] || 0) + 1
  // taux de présence = (présents + retards) / total  (le retard compte comme présence)
  s.rate = s.total ? Math.round(((s.present + s.late) / s.total) * 100) : 100
  return s
}

// Couleur du jour dans le calendrier selon le taux de présence
export function dayTone(rate) {
  if (rate >= 90) return 'good'
  if (rate >= 70) return 'warn'
  return 'bad'
}

const PALETTE = ['#2563eb', '#0d9488', '#16a34a', '#f59e0b', '#e11d48', '#0891b2', '#64748b', '#b45309']
export const randomColor = () => PALETTE[Math.floor(Math.random() * PALETTE.length)]
export const CLASS_COLORS = PALETTE

export const PLAN_LABEL = { free: 'Gratuit', monthly: 'Individuel — mensuel', annual: 'Individuel — annuel' }
export const STATUS_LABEL = { pending: 'En attente', active: 'Validé', suspended: 'Suspendu' }
