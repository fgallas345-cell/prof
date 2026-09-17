// =====================================================================
//  Exports : PDF (jsPDF + autotable) et Excel (SheetJS)
// =====================================================================
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { STATUS, fmtDate, fmtDateShort, fullName, sortStudents, computeStats } from './utils'
import { parseISO, format } from 'date-fns'

const STATUS_FILL = {
  present: [220, 252, 231],
  absent: [254, 226, 226],
  late: [254, 243, 199],
  excused: [217, 245, 240],
}

function header(doc, title, subtitle, teacherName) {
  doc.setFillColor(37, 99, 235)
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 10, 10)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(subtitle, 10, 16)
  if (teacherName) doc.text(`Enseignant : ${teacherName}`, doc.internal.pageSize.getWidth() - 10, 16, { align: 'right' })
  doc.setTextColor(23, 26, 43)
}

function footer(doc) {
  const pages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(144, 149, 176)
    doc.text(
      `Cahier d'appel — généré le ${format(new Date(), 'dd/MM/yyyy HH:mm')} — page ${i}/${pages}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: 'center' }
    )
  }
}

/**
 * Registre de présence d'une classe sur une période (PDF paysage)
 * Lignes = élèves, colonnes = jours où un appel a été fait.
 */
export function exportClassRegisterPDF({ cls, students, records, from, to, teacherName }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const sorted = sortStudents(students)
  const days = [...new Set(records.map((r) => r.date))].sort()
  const byKey = {}
  for (const r of records) byKey[`${r.student_id}|${r.date}`] = r.status

  header(doc, `Registre de présence — ${cls.name}`, `Période du ${fmtDateShort(from)} au ${fmtDateShort(to)} · ${days.length} appel(s)`, teacherName)

  const head = [['Élève', ...days.map((d) => format(parseISO(d), 'dd/MM')), 'Abs.', 'Ret.', 'Exc.', 'Présence']]
  const body = sorted.map((s) => {
    const own = records.filter((r) => r.student_id === s.id)
    const st = computeStats(own)
    return [
      fullName(s),
      ...days.map((d) => STATUS[byKey[`${s.id}|${d}`]]?.short || '–'),
      st.absent, st.late, st.excused, `${st.rate}%`,
    ]
  })

  autoTable(doc, {
    startY: 27,
    head,
    body,
    styles: { fontSize: 7.5, cellPadding: 1.5, halign: 'center' },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { halign: 'left', cellWidth: 45, fontStyle: 'bold' } },
    alternateRowStyles: { fillColor: [248, 249, 254] },
    didParseCell: (data) => {
      if (data.section !== 'body') return
      const col = data.column.index
      if (col >= 1 && col <= days.length) {
        const v = data.cell.raw
        const key = Object.values(STATUS).find((s) => s.short === v)?.key
        if (key) { data.cell.styles.fillColor = STATUS_FILL[key]; data.cell.styles.fontStyle = 'bold' }
      }
    },
  })

  // Légende + totaux
  const y = doc.lastAutoTable.finalY + 8
  doc.setFontSize(9)
  doc.text("Légende : P = Présent · A = Absent · R = Retard · E = Excusé · – = pas d'appel · Taux de présence = (présents + retards) / appels", 10, y)
  const all = computeStats(records)
  doc.text(`Total classe : ${all.present} présences, ${all.absent} absences, ${all.late} retards, ${all.excused} excusés · Taux de présence global : ${all.rate}%`, 10, y + 6)

  footer(doc)
  doc.save(`registre_${slug(cls.name)}_${from}_${to}.pdf`)
}

/** Fiche individuelle d'un élève (PDF portrait) */
export function exportStudentSheetPDF({ student, cls, records, teacherName, from, to }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const st = computeStats(records)
  header(doc, `Fiche élève — ${fullName(student)}`, `Classe ${cls.name} · du ${fmtDateShort(from)} au ${fmtDateShort(to)}`, teacherName)

  // Bloc statistiques
  const cards = [
    ['Appels', st.total, [37, 99, 235]],
    ['Présences', st.present, [22, 163, 74]],
    ['Absences', st.absent, [220, 38, 38]],
    ['Retards', st.late, [245, 158, 11]],
    ['Excusés', st.excused, [13, 148, 136]],
    ['Taux de présence', `${st.rate}%`, [37, 99, 235]],
  ]
  const w = 30, gap = 2, x0 = 10, y0 = 28
  cards.forEach(([label, value, color], i) => {
    const x = x0 + i * (w + gap)
    doc.setFillColor(248, 249, 254)
    doc.roundedRect(x, y0, w, 18, 2, 2, 'F')
    doc.setTextColor(...color)
    doc.setFontSize(14); doc.setFont('helvetica', 'bold')
    doc.text(String(value), x + w / 2, y0 + 9, { align: 'center' })
    doc.setTextColor(91, 96, 122)
    doc.setFontSize(7); doc.setFont('helvetica', 'normal')
    doc.text(label, x + w / 2, y0 + 14.5, { align: 'center' })
  })
  doc.setTextColor(23, 26, 43)

  const events = records.filter((r) => r.status !== 'present').sort((a, b) => a.date.localeCompare(b.date))
  doc.setFontSize(11); doc.setFont('helvetica', 'bold')
  doc.text('Absences, retards et excusés', 10, 56)
  doc.setFont('helvetica', 'normal')

  if (!events.length) {
    doc.setFontSize(10)
    doc.text('Aucune absence ni retard sur la période.', 10, 63)
  } else {
    autoTable(doc, {
      startY: 59,
      head: [['Date', 'Statut', 'Note']],
      body: events.map((r) => [fmtDate(r.date, 'EEEE d MMMM yyyy'), STATUS[r.status].label, r.note || '']),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235] },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          const key = Object.values(STATUS).find((s) => s.label === data.cell.raw)?.key
          if (key) { data.cell.styles.fillColor = STATUS_FILL[key]; data.cell.styles.fontStyle = 'bold' }
        }
      },
    })
  }

  // Signature
  const y = (doc.lastAutoTable?.finalY || 66) + 20
  doc.setFontSize(9); doc.setTextColor(91, 96, 122)
  doc.text("Signature de l'enseignant :", 10, y)
  doc.text('Signature du parent / tuteur :', 110, y)
  doc.setDrawColor(230, 232, 240)
  doc.line(10, y + 18, 90, y + 18)
  doc.line(110, y + 18, 190, y + 18)

  footer(doc)
  doc.save(`fiche_${slug(fullName(student))}_${from}_${to}.pdf`)
}

/** Export Excel : une feuille "Registre" (matrice) + une feuille "Données brutes" + "Synthèse" */
export function exportClassExcel({ cls, students, records, from, to }) {
  const sorted = sortStudents(students)
  const days = [...new Set(records.map((r) => r.date))].sort()
  const byKey = {}
  for (const r of records) byKey[`${r.student_id}|${r.date}`] = r

  // Feuille 1 : Registre
  const registre = [
    ['Nom', 'Prénom', ...days.map((d) => fmtDateShort(d)), 'Absences', 'Retards', 'Excusés', 'Taux présence'],
    ...sorted.map((s) => {
      const st = computeStats(records.filter((r) => r.student_id === s.id))
      return [
        s.last_name, s.first_name,
        ...days.map((d) => STATUS[byKey[`${s.id}|${d}`]?.status]?.short || ''),
        st.absent, st.late, st.excused, st.rate / 100,
      ]
    }),
  ]
  const ws1 = XLSX.utils.aoa_to_sheet(registre)
  ws1['!cols'] = [{ wch: 18 }, { wch: 16 }, ...days.map(() => ({ wch: 11 })), { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 }]
  // pourcentage
  for (let r = 1; r < registre.length; r++) {
    const ref = XLSX.utils.encode_cell({ r, c: registre[0].length - 1 })
    if (ws1[ref]) ws1[ref].z = '0%'
  }

  // Feuille 2 : Données brutes
  const nameOf = {}
  for (const s of students) nameOf[s.id] = s
  const brut = [
    ['Date', 'Nom', 'Prénom', 'Statut', 'Note', 'Enregistré le'],
    ...[...records]
      .sort((a, b) => a.date.localeCompare(b.date) || fullName(nameOf[a.student_id] || {}).localeCompare(fullName(nameOf[b.student_id] || {})))
      .map((r) => [
        fmtDateShort(r.date),
        nameOf[r.student_id]?.last_name || '?',
        nameOf[r.student_id]?.first_name || '',
        STATUS[r.status]?.label || r.status,
        r.note || '',
        r.recorded_at ? format(new Date(r.recorded_at), 'dd/MM/yyyy HH:mm') : '',
      ]),
  ]
  const ws2 = XLSX.utils.aoa_to_sheet(brut)
  ws2['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 10 }, { wch: 30 }, { wch: 18 }]

  // Feuille 3 : Synthèse
  const all = computeStats(records)
  const synth = [
    ['Classe', cls.name],
    ['Période', `${fmtDateShort(from)} → ${fmtDateShort(to)}`],
    ["Nombre d'appels", days.length],
    ["Nombre d'élèves", students.length],
    [],
    ['Présences', all.present],
    ['Absences', all.absent],
    ['Retards', all.late],
    ['Excusés', all.excused],
    ['Taux de présence', all.rate / 100],
  ]
  const ws3 = XLSX.utils.aoa_to_sheet(synth)
  ws3['!cols'] = [{ wch: 20 }, { wch: 24 }]
  ws3['B10'].z = '0%'

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws1, 'Registre')
  XLSX.utils.book_append_sheet(wb, ws2, 'Données brutes')
  XLSX.utils.book_append_sheet(wb, ws3, 'Synthèse')
  XLSX.writeFile(wb, `appel_${slug(cls.name)}_${from}_${to}.xlsx`)
}

/** Modèle Excel vide pour l'import d'élèves */
export function downloadImportTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Nom', 'Prénom'],
    ['DIALLO', 'Aminata'],
    ['NDIAYE', 'Moussa'],
    ['SOW', 'Fatou'],
  ])
  ws['!cols'] = [{ wch: 20 }, { wch: 20 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Élèves')
  XLSX.writeFile(wb, 'modele_import_eleves.xlsx')
}

/**
 * Lit un fichier CSV / Excel et renvoie [{last_name, first_name}]
 * Détection souple des colonnes : "nom", "prénom"/"prenom", "last", "first"…
 * Si une seule colonne : "NOM Prénom" est découpé.
 */
export async function parseStudentFile(file) {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', codepage: 65001 })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' })
  if (!rows.length) return []

  const norm = (v) => String(v || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const first = rows[0].map(norm)
  let iLast = first.findIndex((h) => ['nom', 'nom de famille', 'last_name', 'lastname', 'last', 'name'].includes(h))
  let iFirst = first.findIndex((h) => ['prenom', 'prenoms', 'first_name', 'firstname', 'first'].includes(h))
  const hasHeader = iLast !== -1 || iFirst !== -1
  const data = hasHeader ? rows.slice(1) : rows
  if (!hasHeader) { iLast = 0; iFirst = 1 }

  const out = []
  for (const r of data) {
    let last = String(r[iLast] ?? '').trim()
    let firstN = iFirst >= 0 ? String(r[iFirst] ?? '').trim() : ''
    if (last && !firstN && last.includes(' ')) {
      // colonne unique "NOM Prénom" ou "Prénom NOM" : les mots en MAJUSCULES = nom de famille
      const parts = last.split(/\s+/)
      const upper = parts.filter((p) => p === p.toUpperCase() && p.length > 1)
      if (upper.length && upper.length < parts.length) {
        last = upper.join(' ')
        firstN = parts.filter((p) => !upper.includes(p)).join(' ')
      } else {
        last = parts[0]; firstN = parts.slice(1).join(' ')
      }
    }
    if (last || firstN) out.push({ last_name: last, first_name: firstN })
  }
  return out
}

const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase()
