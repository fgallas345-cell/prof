import { useMemo, useRef, useState } from 'react'
import { Icon, Spinner } from './ui'
import { FIELDS, FIELD_KEYS, readFileToGrid, textToGrid, analyzeGrid, applyMapping, flagDuplicates, recheckRow } from '../lib/importer'
import { todayISO } from '../lib/utils'

const colName = (i) => String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) : '')

/**
 * Assistant d'import d'élèves (PDF / Excel / CSV / texte collé) en 3 étapes :
 *   1. choisir le fichier  2. faire correspondre les colonnes  3. vérifier / corriger puis importer
 */
export default function ImportStudents({ onSubmit, onCancel, busy, existing = [] }) {
  const [step, setStep] = useState('pick') // pick | map | review
  const [source, setSource] = useState('') // nom du fichier ou « texte collé »
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [grid, setGrid] = useState([])
  const [analysis, setAnalysis] = useState(null) // { headerIndex, header, rows, mapping }
  const [mapping, setMapping] = useState(null)
  const [hasHeader, setHasHeader] = useState(true)
  const [rows, setRows] = useState([])

  /* ---------- étape 1 ---------- */
  const load = async (getGrid, label) => {
    setErr(''); setLoading(true)
    try {
      const { grid: g, warnings } = await getGrid()
      if (warnings.includes('scanned')) {
        setErr("Ce PDF est une image scannée : aucun texte ne peut en être extrait. Demandez la version Excel / Word à l'administration, ou copiez-collez la liste si le texte est sélectionnable.")
        return
      }
      if (!g.length) { setErr('Aucune donnée trouvée dans ce fichier.'); return }
      const a = analyzeGrid(g)
      setGrid(g); setAnalysis(a); setMapping(a.mapping); setHasHeader(a.headerIndex !== null); setSource(label)
      setStep('map')
    } catch (e) {
      console.error(e)
      setErr('Impossible de lire ce fichier. Formats acceptés : PDF, Excel (.xlsx/.xls), CSV, texte.')
    } finally { setLoading(false) }
  }
  const pickFile = (file) => file && load(() => readFileToGrid(file), file.name)
  const pasteText = (text) => text.trim() && load(async () => textToGrid(text), 'texte collé')

  /* ---------- étape 2 ---------- */
  const dataRows = useMemo(() => {
    if (!analysis) return []
    if (hasHeader) return analysis.headerIndex !== null ? analysis.rows : grid.slice(1)
    return grid
  }, [analysis, hasHeader, grid])
  const header = hasHeader && analysis ? (analysis.headerIndex !== null ? analysis.header : grid[0]) : null
  const width = Math.max(header?.length || 0, ...dataRows.map((r) => r.length), 0)

  const fieldOf = (idx) => FIELD_KEYS.find((k) => mapping?.[k] === idx) || 'ignore'
  const setField = (idx, key) => setMapping((m) => {
    const next = { ...m }
    for (const k of FIELD_KEYS) if (next[k] === idx) next[k] = null
    if (key !== 'ignore') next[key] = idx
    return next
  })
  const nameMapped = mapping && (mapping.last_name !== null || mapping.full_name !== null)

  const goReview = () => { setRows(applyMapping(dataRows, mapping, existing)); setStep('review') }

  /* ---------- étape 3 ---------- */
  const editRow = (key, patch) => setRows((rs) => flagDuplicates(rs.map((r) => (r.key === key ? recheckRow({ ...r, ...patch }) : r)), existing))
  const removeRow = (key) => setRows((rs) => flagDuplicates(rs.filter((r) => r.key !== key), existing))
  const importable = rows.filter((r) => r.level !== 'error')
  const nWarn = rows.filter((r) => r.level === 'warn').length
  const nErr = rows.length - importable.length

  /* ================================================================ */
  if (step === 'pick') return <PickStep onFile={pickFile} onText={pasteText} onCancel={onCancel} loading={loading} err={err} />

  if (step === 'map') return (
    <div>
      <p className="small muted mb-1"><b>{source}</b> — {dataRows.length} ligne(s) détectée(s). Indiquez à quoi correspond chaque colonne :</p>
      <label className="row small mb-2" style={{ gap: 8, cursor: 'pointer' }}>
        <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
        La première ligne est un en-tête (titres de colonnes)
      </label>

      {/* Mobile : une carte par colonne */}
      <div className="map-cards">
        {Array.from({ length: width }, (_, i) => (
          <div key={i} className={`map-card ${fieldOf(i) !== 'ignore' ? 'on' : ''}`}>
            <div className="grow">
              <div className="small bold">{header?.[i] || `Colonne ${colName(i)}`}</div>
              <div className="xs muted truncate">{dataRows.slice(0, 3).map((r) => r[i]).filter(Boolean).join(' · ') || '(vide)'}</div>
            </div>
            <select className={`input sm ${fieldOf(i) !== 'ignore' ? 'mapped' : ''}`} value={fieldOf(i)} onChange={(e) => setField(i, e.target.value)}>
              {FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>
        ))}
      </div>

      {/* Desktop : tableau avec aperçu */}
      <div className="card flat table-wrap map-table" style={{ padding: 6, maxHeight: '48dvh', overflow: 'auto' }}>
        <table className="table map">
          <thead>
            <tr>
              {Array.from({ length: width }, (_, i) => (
                <th key={i}>
                  <div className="faint xs mb-1">{header?.[i] || `Colonne ${colName(i)}`}</div>
                  <select className={`input sm ${fieldOf(i) !== 'ignore' ? 'mapped' : ''}`} value={fieldOf(i)} onChange={(e) => setField(i, e.target.value)}>
                    {FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.slice(0, 6).map((r, ri) => (
              <tr key={ri}>{Array.from({ length: width }, (_, i) => <td key={i} className={fieldOf(i) === 'ignore' ? 'faint' : ''}>{r[i] || ''}</td>)}</tr>
            ))}
            {dataRows.length > 6 && <tr><td colSpan={width} className="faint xs center">… et {dataRows.length - 6} autre(s) ligne(s)</td></tr>}
          </tbody>
        </table>
      </div>

      {!nameMapped && <p className="input-error mt-2"><Icon.Alert size={16} /> Choisissez au moins la colonne « Nom » ou « Nom + Prénom ».</p>}
      {nameMapped && mapping.birth_date === null && <p className="help mt-2">Aucune colonne « Date de naissance » : vous pourrez la compléter à l'étape suivante ou plus tard, élève par élève.</p>}

      <div className="actions">
        <button type="button" className="btn outline" onClick={() => { setStep('pick'); setErr('') }}>Autre fichier</button>
        <button type="button" className="btn" disabled={!nameMapped} onClick={goReview}>Continuer <Icon.ChevronRight size={16} /></button>
      </div>
    </div>
  )

  /* ---------- review ---------- */
  return (
    <div>
      <div className="row wrap mb-2" style={{ gap: 6 }}>
        <span className="chip success"><Icon.Check size={12} /> {importable.length - nWarn} prêt(s)</span>
        {nWarn > 0 && <span className="chip warning">{nWarn} à vérifier</span>}
        {nErr > 0 && <span className="chip danger">{nErr} ignoré(s) — sans nom</span>}
      </div>
      <p className="help mb-1">Corrigez directement dans le tableau <span className="scroll-hint">(faites défiler horizontalement)</span>. Les lignes « à vérifier » seront importées telles quelles si vous ne les modifiez pas.</p>

      <div className="card flat table-wrap" style={{ padding: 6, maxHeight: '48dvh', overflow: 'auto' }}>
        <table className="table review">
          <thead><tr><th>#</th><th>Nom</th><th>Prénom</th><th>Naissance</th><th>Identifiant</th><th></th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key} className={r.level}>
                <td className="muted xs">{i + 1}</td>
                <td><input className="input sm" value={r.last_name} onChange={(e) => editRow(r.key, { last_name: e.target.value })} placeholder="Nom" /></td>
                <td><input className="input sm" value={r.first_name} onChange={(e) => editRow(r.key, { first_name: e.target.value })} placeholder="Prénom" /></td>
                <td><input type="date" className="input sm" value={r.birth_date || ''} max={todayISO()} onChange={(e) => editRow(r.key, { birth_date: e.target.value })} /></td>
                <td><input className="input sm" value={r.student_code || ''} onChange={(e) => editRow(r.key, { student_code: e.target.value })} placeholder="—" /></td>
                <td><button type="button" className="btn ghost icon sm" onClick={() => removeRow(r.key)} aria-label="Retirer cette ligne" style={{ color: 'var(--danger)' }}><Icon.X size={16} /></button></td>
              </tr>
            )).flatMap((tr, i) => rows[i].issues.length ? [tr, (
              <tr key={`${rows[i].key}-i`} className={`issue ${rows[i].level}`}>
                <td></td>
                <td colSpan={5} className="xs">
                  <Icon.Alert size={13} style={{ verticalAlign: -2 }} /> {rows[i].issues.join(' · ')}
                  {rows[i].level === 'error' && rows[i].raw && <span className="faint"> — ligne d'origine : « {rows[i].raw.filter(Boolean).join(' | ')} »</span>}
                </td>
              </tr>
            )] : [tr])}
          </tbody>
        </table>
      </div>

      <div className="actions">
        <button type="button" className="btn outline" onClick={() => setStep('map')}><Icon.ChevronLeft size={16} /> Colonnes</button>
        <button type="button" className="btn" disabled={busy || !importable.length} onClick={() => onSubmit(importable.map(({ last_name, first_name, birth_date, student_code }) => ({ last_name, first_name, birth_date, student_code })))}>
          {busy ? <Spinner white /> : `Importer ${importable.length} élève(s)`}
        </button>
      </div>
    </div>
  )
}

/* ---------------- Étape 1 : fichier ou texte collé ---------------- */
function PickStep({ onFile, onText, onCancel, loading, err }) {
  const ref = useRef()
  const [mode, setMode] = useState('file')
  const [text, setText] = useState('')
  return (
    <div>
      <div className="seg mb-2">
        <button type="button" className={mode === 'file' ? 'on' : ''} onClick={() => setMode('file')}><Icon.Upload size={15} /> Fichier</button>
        <button type="button" className={mode === 'text' ? 'on' : ''} onClick={() => setMode('text')}><Icon.File size={15} /> Coller du texte</button>
      </div>

      {mode === 'file' ? (
        <>
          <div className="locked" onClick={() => !loading && ref.current.click()} style={{ cursor: 'pointer' }}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }}>
            {loading ? <div className="row" style={{ justifyContent: 'center' }}><Spinner /> <span className="small muted">Lecture du fichier…</span></div> : (
              <>
                <div className="icon">📄</div>
                <p className="bold mt-1">Choisir le fichier reçu de l'administration</p>
                <p className="help"><b>PDF</b>, <b>Excel</b> (.xlsx / .xls), <b>CSV</b> ou texte. Peu importe l'ordre des colonnes : vous les ferez correspondre à l'étape suivante.</p>
              </>
            )}
            <input ref={ref} type="file" accept=".pdf,.csv,.xlsx,.xls,.txt,application/pdf" hidden onChange={(e) => { onFile(e.target.files[0]); e.target.value = '' }} />
          </div>
          <button type="button" className="btn ghost block mt-2" onClick={() => import('../lib/export').then((m) => m.downloadImportTemplate())}><Icon.Download /> Télécharger un modèle Excel</button>
        </>
      ) : (
        <div className="field">
          <label>Collez la liste (copiée depuis le PDF, un mail, Word…)</label>
          <textarea className="input" rows={9} autoFocus value={text} onChange={(e) => setText(e.target.value)}
            placeholder={'1  DIALLO  Aminata  12/03/2012\n2  NDIAYE  Moussa  05/11/2011\n…'} />
          <span className="help">Une ligne par élève. Colonnes séparées par des tabulations, « ; », virgules ou plusieurs espaces.</span>
          <button type="button" className="btn secondary mt-1" disabled={!text.trim() || loading} onClick={() => onText(text)}>{loading ? <Spinner /> : 'Analyser le texte'}</button>
        </div>
      )}

      {err && <p className="input-error mt-2"><Icon.Alert size={16} /> {err}</p>}
      <div className="actions"><button type="button" className="btn outline" onClick={onCancel}>Annuler</button></div>
    </div>
  )
}
