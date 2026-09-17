// Base locale IndexedDB (Dexie) : cache des classes/élèves + appels hors-ligne
import Dexie from 'dexie'

export const db = new Dexie('cahier-appel')

db.version(1).stores({
  classes: 'id, teacher_id, name',
  students: 'id, class_id, teacher_id, last_name',
  // clé primaire composée élève+date : un seul enregistrement par élève et par jour
  attendance: '[student_id+date], id, class_id, date, student_id, pending, [class_id+date]',
  meta: 'key',
})

export async function clearLocalData() {
  await db.transaction('rw', db.classes, db.students, db.attendance, db.meta, async () => {
    await db.classes.clear()
    await db.students.clear()
    await db.attendance.clear()
    await db.meta.clear()
  })
}
