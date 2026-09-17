// =====================================================================
//  Couche d'accès aux données : Supabase (en ligne) + Dexie (cache / hors-ligne)
//  - Classes & élèves : lus depuis Supabase quand possible, mis en cache localement.
//  - Appels : "local-first" → toujours écrits dans IndexedDB puis synchronisés.
// =====================================================================
import { supabase } from './supabase'
import { db } from './db'
import { isOnline } from './online'
import { uuid, todayISO } from './utils'
import { startOfMonth, endOfMonth, format, subMonths } from 'date-fns'

let currentTeacherId = null
export const setCurrentTeacher = (id) => { currentTeacherId = id }

const uid = () => {
  if (!currentTeacherId) throw new Error('Utilisateur non connecté')
  return currentTeacherId
}

function fail(error) {
  if (!error) return
  const msg = error.message || String(error)
  if (msg.includes('FREE_PLAN_LIMIT')) throw new Error('Le plan gratuit est limité à 1 classe. Passez au plan individuel pour créer plus de classes.')
  if (msg.includes('row-level security')) throw new Error("Accès refusé : votre compte n'est pas encore validé.")
  throw new Error(msg)
}

// ---------------------------------------------------------------- Classes
export async function listClasses() {
  if (isOnline() && supabase) {
    const { data, error } = await supabase.from('classes').select('*').order('created_at')
    if (!error && data) {
      await db.transaction('rw', db.classes, async () => {
        await db.classes.where('teacher_id').equals(uid()).delete()
        await db.classes.bulkPut(data)
      })
      return data
    }
  }
  return db.classes.where('teacher_id').equals(uid()).sortBy('created_at')
}

export async function getClass(id) {
  const local = await db.classes.get(id)
  if (local) return local
  if (isOnline() && supabase) {
    const { data } = await supabase.from('classes').select('*').eq('id', id).single()
    if (data) { await db.classes.put(data); return data }
  }
  return null
}

export async function createClass({ name, level, color }) {
  if (!isOnline()) throw new Error('La création de classe nécessite une connexion internet.')
  const row = { id: uuid(), teacher_id: uid(), name: name.trim(), level: level?.trim() || null, color }
  const { data, error } = await supabase.from('classes').insert(row).select().single()
  fail(error)
  await db.classes.put(data)
  return data
}

export async function updateClass(id, patch) {
  if (!isOnline()) throw new Error('La modification nécessite une connexion internet.')
  const { data, error } = await supabase.from('classes').update(patch).eq('id', id).select().single()
  fail(error)
  await db.classes.put(data)
  return data
}

export async function deleteClass(id) {
  if (!isOnline()) throw new Error('La suppression nécessite une connexion internet.')
  const { error } = await supabase.from('classes').delete().eq('id', id)
  fail(error)
  await db.transaction('rw', db.classes, db.students, db.attendance, async () => {
    await db.classes.delete(id)
    await db.students.where('class_id').equals(id).delete()
    await db.attendance.where('class_id').equals(id).delete()
  })
}

// ---------------------------------------------------------------- Élèves
export async function listStudents(classId) {
  if (isOnline() && supabase) {
    const { data, error } = await supabase.from('students').select('*').eq('class_id', classId)
    if (!error && data) {
      await db.transaction('rw', db.students, async () => {
        await db.students.where('class_id').equals(classId).delete()
        await db.students.bulkPut(data)
      })
      return data
    }
  }
  return db.students.where('class_id').equals(classId).toArray()
}

export async function listAllStudents() {
  if (isOnline() && supabase) {
    const { data, error } = await supabase.from('students').select('*')
    if (!error && data) {
      await db.transaction('rw', db.students, async () => {
        await db.students.where('teacher_id').equals(uid()).delete()
        await db.students.bulkPut(data)
      })
      return data
    }
  }
  return db.students.where('teacher_id').equals(uid()).toArray()
}

export async function getStudent(id) {
  const local = await db.students.get(id)
  if (local) return local
  if (isOnline() && supabase) {
    const { data } = await supabase.from('students').select('*').eq('id', id).single()
    if (data) { await db.students.put(data); return data }
  }
  return null
}

export async function addStudents(classId, students) {
  if (!isOnline()) throw new Error("L'ajout d'élèves nécessite une connexion internet.")
  const rows = students
    .map((s) => ({
      id: uuid(),
      teacher_id: uid(),
      class_id: classId,
      first_name: (s.first_name || '').trim(),
      last_name: (s.last_name || '').trim(),
      ...cleanStudentExtras(s),
    }))
    .filter((s) => s.first_name || s.last_name)
  if (!rows.length) return []
  const { data, error } = await supabase.from('students').insert(rows).select()
  fail(error)
  await db.students.bulkPut(data)
  return data
}

/** birth_date vide → null ; student_code vide → null (les deux colonnes sont nullables) */
function cleanStudentExtras(s) {
  return {
    birth_date: s.birth_date ? String(s.birth_date).slice(0, 10) : null,
    student_code: (s.student_code || '').trim() || null,
  }
}

export async function updateStudent(id, patch) {
  if (!isOnline()) throw new Error('La modification nécessite une connexion internet.')
  const clean = { ...patch }
  if ('birth_date' in patch || 'student_code' in patch) Object.assign(clean, cleanStudentExtras(patch))
  const { data, error } = await supabase.from('students').update(clean).eq('id', id).select().single()
  fail(error)
  await db.students.put(data)
  return data
}

export async function deleteStudent(id) {
  if (!isOnline()) throw new Error('La suppression nécessite une connexion internet.')
  const { error } = await supabase.from('students').delete().eq('id', id)
  fail(error)
  await db.transaction('rw', db.students, db.attendance, async () => {
    await db.students.delete(id)
    await db.attendance.where('student_id').equals(id).delete()
  })
}

// ---------------------------------------------------------------- Appels (local-first)

/** Fusionne des enregistrements serveur dans le cache local sans écraser les modifications en attente */
async function mergeServerRecords(rows) {
  await db.transaction('rw', db.attendance, async () => {
    for (const r of rows) {
      const local = await db.attendance.get([r.student_id, r.date])
      if (local && local.pending === 1) continue
      await db.attendance.put({ ...r, pending: 0 })
    }
  })
}

/** Appel d'une classe pour une date donnée → { student_id: record } */
export async function getAttendanceForDay(classId, date) {
  if (isOnline() && supabase) {
    const { data, error } = await supabase
      .from('attendance_records').select('*').eq('class_id', classId).eq('date', date)
    if (!error && data) await mergeServerRecords(data)
  }
  const rows = await db.attendance.where('[class_id+date]').equals([classId, date]).toArray()
  const map = {}
  for (const r of rows) map[r.student_id] = r
  return map
}

/** Enregistre (ou corrige) l'appel : toujours en local d'abord, puis synchro. */
export async function saveAttendance(classId, date, entries /* [{student_id, status}] */) {
  const now = new Date().toISOString()
  const rows = entries.map((e) => ({
    id: e.id || uuid(),
    teacher_id: uid(),
    class_id: classId,
    student_id: e.student_id,
    date,
    status: e.status,
    note: e.note || null,
    recorded_at: now,
    pending: 1,
  }))
  await db.transaction('rw', db.attendance, async () => {
    for (const r of rows) {
      const existing = await db.attendance.get([r.student_id, r.date])
      await db.attendance.put({ ...r, id: existing?.id || r.id })
    }
  })
  // synchro immédiate si possible (non bloquante)
  syncPending().catch(() => {})
  return rows
}

/** Enregistrements d'une classe sur une période (inclusive) */
export async function getAttendanceRange(classId, from, to) {
  if (isOnline() && supabase) {
    const { data, error } = await supabase
      .from('attendance_records').select('*')
      .eq('class_id', classId).gte('date', from).lte('date', to)
    if (!error && data) await mergeServerRecords(data)
  }
  return db.attendance
    .where('[class_id+date]').between([classId, from], [classId, to], true, true)
    .toArray()
}

export async function getAttendanceForMonth(classId, monthDate) {
  const from = format(startOfMonth(monthDate), 'yyyy-MM-dd')
  const to = format(endOfMonth(monthDate), 'yyyy-MM-dd')
  return getAttendanceRange(classId, from, to)
}

/** Historique complet d'un élève */
export async function getStudentHistory(studentId, from = null) {
  if (isOnline() && supabase) {
    let q = supabase.from('attendance_records').select('*').eq('student_id', studentId)
    if (from) q = q.gte('date', from)
    const { data, error } = await q
    if (!error && data) await mergeServerRecords(data)
  }
  let rows = await db.attendance.where('student_id').equals(studentId).toArray()
  if (from) rows = rows.filter((r) => r.date >= from)
  return rows.sort((a, b) => b.date.localeCompare(a.date))
}

/** Dates où un appel a été fait pour la classe (aujourd'hui) — pour l'accueil */
export async function getTodayDoneMap(classIds) {
  const today = todayISO()
  const map = {}
  if (isOnline() && supabase && classIds.length) {
    const { data } = await supabase
      .from('attendance_records').select('class_id, student_id, date, status, id, teacher_id, recorded_at, note')
      .eq('date', today).in('class_id', classIds)
    if (data) await mergeServerRecords(data)
  }
  for (const id of classIds) {
    const n = await db.attendance.where('[class_id+date]').equals([id, today]).count()
    map[id] = n
  }
  return map
}

/** Récap de la semaine / du mois pour l'accueil */
export async function getRecentStats(days = 30) {
  const from = format(subMonths(new Date(), 1), 'yyyy-MM-dd')
  if (isOnline() && supabase) {
    const { data } = await supabase.from('attendance_records').select('*').gte('date', from)
    if (data) await mergeServerRecords(data)
  }
  const rows = await db.attendance.where('date').aboveOrEqual(from).toArray()
  return rows
}

// ---------------------------------------------------------------- Synchronisation
let syncing = false
const listeners = new Set()
export const onSyncChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }
const notify = () => listeners.forEach((fn) => fn())

export const countPending = () => db.attendance.where('pending').equals(1).count()

export async function syncPending() {
  if (syncing || !isOnline() || !supabase || !currentTeacherId) return { pushed: 0 }
  syncing = true
  notify()
  try {
    const pending = await db.attendance.where('pending').equals(1).toArray()
    if (!pending.length) return { pushed: 0 }
    const payload = pending.map(({ pending: _p, ...r }) => r)
    // par lots de 200
    for (let i = 0; i < payload.length; i += 200) {
      const chunk = payload.slice(i, i + 200)
      const { error } = await supabase
        .from('attendance_records')
        .upsert(chunk, { onConflict: 'student_id,date', ignoreDuplicates: false })
      if (error) throw error
      await db.transaction('rw', db.attendance, async () => {
        for (const r of chunk) await db.attendance.update([r.student_id, r.date], { pending: 0 })
      })
    }
    await db.meta.put({ key: 'lastSync', value: new Date().toISOString() })
    return { pushed: payload.length }
  } finally {
    syncing = false
    notify()
  }
}

export const isSyncing = () => syncing

// synchro automatique dès que la connexion revient
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { syncPending().catch(() => {}) })
}

// ---------------------------------------------------------------- Profil
export async function getProfile(id) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function updateProfile(id, patch) {
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', id).select().single()
  fail(error)
  return data
}

// ---------------------------------------------------------------- Admin
export async function adminListProfiles() {
  const [{ data: profiles, error }, { data: stats }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('admin_teacher_stats').select('*'),
  ])
  fail(error)
  const byId = {}
  for (const s of stats || []) byId[s.id] = s
  return (profiles || []).map((p) => ({ ...p, stats: byId[p.id] || {} }))
}

export async function adminUpdateProfile(id, patch) {
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', id).select().single()
  fail(error)
  return data
}
