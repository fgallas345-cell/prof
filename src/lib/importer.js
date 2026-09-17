// =====================================================================
//  Import d'élèves depuis un fichier (PDF, Excel, CSV, texte collé)
//  1. readFileToGrid()  → grille brute (lignes × colonnes de texte)
//  2. analyzeGrid()     → en-tête détecté + correspondance des colonnes devinée
//  3. applyMapping()    → élèves {last_name, first_name, birth_date, student_code, issues}
// =====================================================================
import * as XLSX from 'xlsx'
import { toISODate, fullName } from './utils'

/** Champs cibles proposés pour chaque colonne du fichier */
export const FIELDS = [
  { key: 'ignore', label: 'Ignorer' },
  { key: 'last_name', label: 'Nom' },
  { key: 'first_name', label: 'Prénom' },
  { key: 'full_name', label: 'Nom + Prénom (même colonne)' },
  { key: 'birth_date', label: 'Date de naissance' },
  { key: 'student_code', label: 'Identifiant / matricule' },
]
export const FIELD_KEYS = ['last_name', 'first_name', 'full_name', 'birth_date', 'student_code']

const norm = (v) => String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// mots-clés d'en-tête → champ
const HEADER_HINTS = [
  ['full_name', ['nom et prenom', 'nom & prenom', 'nom prenom', 'noms et prenoms', 'nom complet', 'eleve', 'eleves', 'nom_complet', 'fullname', 'full_name']],
  ['last_name', ['nom', 'noms', 'nom de famille', 'last_name', 'lastname', 'last', 'name', 'surname']],
  ['first_name', ['prenom', 'prenoms', 'first_name', 'firstname', 'first', 'prenom(s)']],
  ['birth_date', ['date de naissance', 'naissance', 'ne le', 'nee le', 'ne(e) le', 'date naiss', 'date_naissance', 'birth', 'birthdate', 'birth_date', 'ddn', 'dn']],
  ['student_code', ['identifiant', 'matricule', 'id', 'code', 'ine', 'student_code', 'numero matricule', 'n° matricule', 'no matricule', 'immatriculation']],
]
const isDateLike = (v) => !!toISODate(v) && /\d/.test(String(v))
const hasLetter = (v) => /\p{L}/u.test(String(v ?? ''))

/* ------------------------------------------------------------------ */
/*  1. Lecture du fichier → grille                                      */
/* ------------------------------------------------------------------ */

/**
 * @returns {Promise<{ grid: string[][], source: 'pdf'|'sheet'|'text', warnings: string[] }>}
 * warnings : 'scanned' (PDF sans texte extractible), 'empty'
 */
export async function readFileToGrid(file) {
  const name = (file.name || '').toLowerCase()
  const buf = await file.arrayBuffer()
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return pdfToGrid(buf)
  if (name.endsWith('.txt') || file.type === 'text/plain') return { ...textToGrid(new TextDecoder().decode(buf)), source: 'text' }
  return sheetToGrid(buf)
}

/** Texte collé (depuis un PDF ouvert, un mail…) → grille */
export function textToGrid(text) {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.replace(/ /g, ' ').trimEnd()).filter((l) => l.trim())
  const sep = lines.some((l) => l.includes('\t')) ? /\t/
    : lines.filter((l) => l.includes(';')).length > lines.length / 2 ? /;/
    : lines.filter((l) => l.includes(',')).length > lines.length / 2 ? /,/
    : lines.filter((l) => / {2,}/.test(l)).length > lines.length / 2 ? / {2,}/
    : null
  const grid = lines.map((l) => (sep ? l.split(sep) : [l]).map((c) => c.trim()))
  return { grid: normalizeGrid(grid), source: 'text', warnings: grid.length ? [] : ['empty'] }
}

function sheetToGrid(buf) {
  // raw: true → les textes restent des chaînes (sinon « 12/03/2012 » serait lu à l'américaine) ; cellDates → vraies dates Excel en Date
  const wb = XLSX.read(buf, { type: 'array', codepage: 65001, cellDates: true, raw: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' })
  const grid = rows.map((r) => r.map((c) => (c instanceof Date ? toISODate(c) : String(c ?? '').trim())))
  return { grid: normalizeGrid(grid), source: 'sheet', warnings: grid.length ? [] : ['empty'] }
}

/**
 * PDF → grille : pdf.js donne chaque fragment de texte avec sa position (x, y).
 * On regroupe par ligne (même y), on fusionne les fragments proches en cellules,
 * puis on aligne les cellules sur des colonnes détectées à partir de leurs positions x.
 */
async function pdfToGrid(buf) {
  const pdfjs = await import('pdfjs-dist')
  const { default: workerSrc } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise

  const lines = [] // [{ cells: [{x0, x1, text}] }]
  let chars = 0
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    const rows = []
    for (const it of content.items) {
      if (!it.str || !it.str.trim()) continue
      chars += it.str.trim().length
      const x = it.transform[4], y = it.transform[5], h = it.height || 10
      let row = rows.find((r) => Math.abs(r.y - y) <= Math.max(2.5, h * 0.55))
      if (!row) { row = { y, items: [] }; rows.push(row) }
      row.items.push({ x0: x, x1: x + (it.width || 0), text: it.str, h })
    }
    rows.sort((a, b) => b.y - a.y) // haut de page en premier
    for (const r of rows) {
      r.items.sort((a, b) => a.x0 - b.x0)
      const cells = []
      for (const it of r.items) {
        const last = cells[cells.length - 1]
        const tol = Math.max(4, it.h * 0.9) // un espace ≈ 0,3 h ; un écart de colonne ≫ h
        if (last && it.x0 - last.x1 <= tol) {
          last.text += (it.x0 - last.x1 > 0.4 && !last.text.endsWith(' ') && !it.text.startsWith(' ') ? ' ' : '') + it.text
          last.x1 = Math.max(last.x1, it.x1)
        } else cells.push({ ...it })
      }
      lines.push(cells.map((c) => ({ ...c, text: c.text.replace(/\s+/g, ' ').trim() })))
    }
  }
  if (!chars) return { grid: [], source: 'pdf', warnings: ['scanned'] }
  return { grid: normalizeGrid(alignColumns(lines)), source: 'pdf', warnings: [] }
}

/** Aligne des lignes de cellules positionnées sur des colonnes communes (regroupement des x de départ) */
function alignColumns(lines) {
  const starts = lines.flatMap((cells) => cells.map((c) => c.x0)).sort((a, b) => a - b)
  const clusters = []
  for (const x of starts) {
    const c = clusters[clusters.length - 1]
    if (c && x - c.last <= 9) { c.last = x; c.n++; c.sum += x } else clusters.push({ first: x, last: x, n: 1, sum: x })
  }
  const minN = Math.max(2, Math.floor(lines.length * 0.12))
  const cols = clusters.filter((c) => c.n >= minN).map((c) => c.first - 1)
  if (cols.length < 2) return lines.map((cells) => cells.map((c) => c.text))
  return lines.map((cells) => {
    const row = Array(cols.length).fill('')
    for (const cell of cells) {
      // colonne = dernière dont le début est ≤ x0 de la cellule (+ tolérance)
      let idx = 0
      for (let i = 0; i < cols.length; i++) if (cols[i] <= cell.x0 + 3) idx = i
      row[idx] = row[idx] ? `${row[idx]} ${cell.text}` : cell.text
    }
    return row
  })
}

/** Supprime les colonnes vides et les lignes vides, égalise le nombre de colonnes */
function normalizeGrid(grid) {
  const width = Math.max(0, ...grid.map((r) => r.length))
  let g = grid.map((r) => Array.from({ length: width }, (_, i) => String(r[i] ?? '').trim()))
  const keep = Array.from({ length: width }, (_, i) => g.some((r) => r[i]))
  g = g.map((r) => r.filter((_, i) => keep[i])).filter((r) => r.some(Boolean))
  return g
}

/* ------------------------------------------------------------------ */
/*  2. Analyse : en-tête + correspondance devinée                       */
/* ------------------------------------------------------------------ */

function headerField(cell) {
  const h = norm(cell).replace(/[:*]/g, '').trim()
  if (!h) return null
  for (const [field, words] of HEADER_HINTS) if (words.includes(h)) return field
  for (const [field, words] of HEADER_HINTS) if (words.some((w) => w.length > 3 && h.includes(w))) return field
  return null
}

/**
 * @returns {{ headerIndex: number|null, header: string[]|null, rows: string[][], mapping: object }}
 * mapping : { last_name: idx|null, first_name, full_name, birth_date, student_code }
 */
export function analyzeGrid(grid) {
  // ligne d'en-tête = parmi les 10 premières, celle qui contient le plus de mots-clés (au moins 1 « nom »)
  // (une ligne de titre « LISTE DES ÉLÈVES » n'a qu'une cellule : ce n'est pas un en-tête)
  let headerIndex = null, best = 0
  grid.slice(0, 10).forEach((r, i) => {
    if (r.filter(Boolean).length < 2) return
    const fields = r.map(headerField).filter(Boolean)
    const score = fields.length + (fields.some((f) => f === 'last_name' || f === 'full_name') ? 1 : 0)
    if (fields.some((f) => f === 'last_name' || f === 'full_name') && score > best) { best = score; headerIndex = i }
  })
  const header = headerIndex !== null ? grid[headerIndex] : null
  let rows = headerIndex !== null ? grid.slice(headerIndex + 1) : grid
  // lignes parasites : en-tête répété (PDF multi-pages), lignes sans aucune lettre (n° de page…)
  const headerKey = header ? header.map(norm).join('|') : null
  rows = rows.filter((r) => r.some(hasLetter) && (!headerKey || r.map(norm).join('|') !== headerKey))

  const mapping = guessMapping(header, rows)
  return { headerIndex, header, rows, mapping }
}

function guessMapping(header, rows) {
  const width = Math.max(header?.length || 0, ...rows.map((r) => r.length))
  const mapping = { last_name: null, first_name: null, full_name: null, birth_date: null, student_code: null }
  const taken = new Set()
  const assign = (field, idx) => { if (mapping[field] === null && !taken.has(idx)) { mapping[field] = idx; taken.add(idx) } }

  // a) d'après l'en-tête
  if (header) header.forEach((cell, idx) => { const f = headerField(cell); if (f) assign(f, idx) })

  // b) d'après le contenu des colonnes restantes
  const sample = rows.slice(0, 50)
  const stats = Array.from({ length: width }, (_, idx) => {
    const vals = sample.map((r) => r[idx] || '').filter(Boolean)
    const n = vals.length || 1
    const dates = vals.filter(isDateLike).length / n
    const ints = vals.filter((v) => /^\d{1,4}$/.test(v)).length / n
    const codes = vals.filter((v) => /^[A-Za-z0-9\-_/.]{2,}$/.test(v) && /\d/.test(v) && !isDateLike(v)).length / n
    const words = vals.map((v) => v.split(/\s+/).length)
    const multi = words.filter((w) => w >= 2).length / n
    const mixed = vals.filter((v) => { const ws = v.split(/\s+/); return ws.some((w) => w === w.toUpperCase() && /\p{L}/u.test(w)) && ws.some((w) => w !== w.toUpperCase()) }).length / n
    const text = vals.filter(hasLetter).length / n
    return { idx, dates, ints, codes, multi, mixed, text, empty: vals.length === 0 }
  })
  for (const s of stats) {
    if (taken.has(s.idx) || s.empty) continue
    if (s.dates >= 0.6) assign('birth_date', s.idx)
    else if (s.ints >= 0.9) taken.add(s.idx) // numéro d'ordre → ignoré
    else if (s.codes >= 0.7) assign('student_code', s.idx)
  }
  const textCols = stats.filter((s) => !taken.has(s.idx) && !s.empty && s.text >= 0.7)
  if (mapping.last_name === null && mapping.full_name === null && textCols[0]) {
    const c = textCols.shift()
    if (c.mixed >= 0.5 || (c.multi >= 0.8 && textCols.length === 0)) assign('full_name', c.idx)
    else assign('last_name', c.idx)
  }
  if (mapping.first_name === null && mapping.full_name === null && textCols[0]) assign('first_name', textCols.shift().idx)
  return mapping
}

/* ------------------------------------------------------------------ */
/*  3. Application de la correspondance → élèves                       */
/* ------------------------------------------------------------------ */

/**
 * Lit une ligne « NOM Prénom » avec, en option, une date de naissance et un identifiant :
 *   DIALLO Aminata ; 12/03/2012 ; A123     (séparateurs acceptés : ; , tabulation ou 2 espaces)
 *   DIALLO Aminata 12/03/2012
 */
export function parseStudentLine(line) {
  const out = { last_name: '', first_name: '', birth_date: '', student_code: '' }
  let parts = String(line || '').split(/[;,\t]| {2,}/).map((p) => p.trim()).filter(Boolean)
  const di = parts.findIndex(isDateLike)
  if (di !== -1) { out.birth_date = toISODate(parts[di]); parts.splice(di, 1) }
  else {
    const words = parts.join(' ').split(/\s+/)
    const wi = words.findIndex(isDateLike)
    if (wi !== -1) { out.birth_date = toISODate(words[wi]); words.splice(wi, 1); parts = [words.join(' ')] }
  }
  const words = (parts[0] || '').split(/\s+/).filter(Boolean)
  const upper = words.filter((w) => w === w.toUpperCase() && w.length > 1 && /\D/.test(w))
  const firstIsFullName = words.length > 1 && upper.length > 0 && upper.length < words.length // ex. « DIALLO Aminata »
  if (parts.length >= 2 && !firstIsFullName) {
    out.last_name = parts[0]; out.first_name = parts[1]; out.student_code = parts.slice(2).join(' ')
  } else if (firstIsFullName) {
    out.last_name = upper.join(' '); out.first_name = words.filter((w) => !upper.includes(w)).join(' ')
    out.student_code = parts.slice(1).join(' ')
  } else {
    out.last_name = words[0] || ''; out.first_name = words.slice(1).join(' ')
  }
  return out
}

/**
 * @param rows      lignes de données (string[][])
 * @param mapping   { last_name, first_name, full_name, birth_date, student_code } → index de colonne ou null
 * @param existing  élèves déjà dans la classe (détection des doublons)
 * @returns élèves avec `issues` (libellés) et `level` : 'ok' | 'warn' (importable) | 'error' (ignoré)
 */
export function applyMapping(rows, mapping, existing = []) {
  const get = (r, k) => (mapping[k] === null || mapping[k] === undefined ? '' : String(r[mapping[k]] ?? '').trim())
  const out = rows.map((r, i) => {
    let last = get(r, 'last_name'), first = get(r, 'first_name')
    let birth = '', code = get(r, 'student_code'), rawDate = get(r, 'birth_date')
    const full = get(r, 'full_name')
    if (full) {
      const p = parseStudentLine(full)
      last ||= p.last_name; first ||= p.first_name; code ||= p.student_code
      if (!rawDate && p.birth_date) rawDate = p.birth_date
    }
    birth = toISODate(rawDate)
    const issues = []
    let level = 'ok'
    if (!last && !first) { issues.push('Nom et prénom manquants'); level = 'error' }
    else if (!last) { issues.push('Nom manquant'); level = 'warn' }
    else if (!first) { issues.push('Prénom manquant'); level = 'warn' }
    if (rawDate && !birth) { issues.push(`Date non reconnue : « ${rawDate} »`); level = level === 'error' ? level : 'warn' }
    else if (!birth) { issues.push('Date de naissance manquante'); level = level === 'error' ? level : 'warn' }
    return { key: i, last_name: last, first_name: first, birth_date: birth, student_code: code, issues, level, raw: r }
  })
  return flagDuplicates(out, existing)
}

/** Marque les doublons (même nom + prénom + date, sans identifiant distinct) dans le fichier et avec la classe */
export function flagDuplicates(list, existing = []) {
  const sig = (s) => `${fullName(s).toLowerCase()}|${s.birth_date || ''}|${(s.student_code || '').toLowerCase()}`
  const inClass = new Set(existing.map(sig))
  const seen = new Map()
  for (const s of list) {
    if (s.level === 'error' || !fullName(s)) continue
    const k = sig(s)
    if (inClass.has(k)) { s.issues = [...s.issues.filter((x) => !x.startsWith('Déjà')), 'Déjà dans la classe']; s.level = s.level === 'error' ? s.level : 'warn' }
    if (seen.has(k)) { s.issues = [...s.issues.filter((x) => !x.startsWith('Doublon')), `Doublon de la ligne ${seen.get(k) + 1}`]; s.level = s.level === 'error' ? s.level : 'warn' }
    else seen.set(k, list.indexOf(s))
  }
  return list
}

/** Recalcule les anomalies d'une ligne après modification manuelle */
export function recheckRow(s) {
  const issues = []
  let level = 'ok'
  if (!s.last_name && !s.first_name) { issues.push('Nom et prénom manquants'); level = 'error' }
  else if (!s.last_name) { issues.push('Nom manquant'); level = 'warn' }
  else if (!s.first_name) { issues.push('Prénom manquant'); level = 'warn' }
  if (!s.birth_date) { issues.push('Date de naissance manquante'); level = level === 'error' ? level : 'warn' }
  return { ...s, issues, level }
}
