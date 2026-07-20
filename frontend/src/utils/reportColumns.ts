import type { TFunction } from 'i18next'
import type { ReportStudent, ReportStudentColumn } from '../types/reports'

export const reportStudentColumnOrder: ReportStudentColumn[] = [
  'full_name',
  'email',
  'phone',
  'dormitory_name',
  'room_number',
]

export function reportStudentColumnLabel(column: ReportStudentColumn, t: TFunction): string {
  return t(`admin.reports.column.${column}`)
}

export function reportStudentColumnValue(student: ReportStudent, column: ReportStudentColumn): string {
  switch (column) {
    case 'full_name':
      return student.student_full_name
    case 'email':
      return student.student_email
    case 'phone':
      return student.student_phone
    case 'dormitory_name':
      return student.dormitory_name
    case 'room_number':
      return student.room_number ?? '—'
  }
}
