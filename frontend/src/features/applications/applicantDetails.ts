import type { AcademicDegree } from '../../types'

// Everything the documents generated for an application need from the
// student: the petition (on submit), the contract (step 4), the referral and
// the certificate of residence (later). Keep in sync with those templates.
export const DETAIL_FIELDS = ['iin', 'phone', 'course', 'institute', 'study_group', 'hometown', 'parent_contact'] as const
export type DetailField = (typeof DETAIL_FIELDS)[number]
export type DetailValues = Record<DetailField, string>

// IIN and course can be filled in once but not changed: changing a recorded
// value is a manager's job (see the backend's StudentDetailsInput).
export const LOCKED_ONCE_SET: DetailField[] = ['iin', 'course']

export const MAX_COURSE: Record<AcademicDegree, number> = { bachelor: 4, master: 2, doctorate: 3 }

export const MAX_LENGTH: Partial<Record<DetailField, number>> = {
  iin: 12,
  phone: 32,
  institute: 200,
  study_group: 50,
  hometown: 255,
  parent_contact: 30,
}

// The fields to show as inputs: what the profile was missing, plus, once the
// student asks to change them, the editable ones it already had.
export function visibleDetailFields(asked: DetailField[], editingKnown: boolean): DetailField[] {
  return DETAIL_FIELDS.filter((f) => asked.includes(f) || (editingKnown && !LOCKED_ONCE_SET.includes(f)))
}

// What's wrong with the visible fields, as an i18n key, or null when all is
// well. The server checks the same rules again.
export function detailsError(values: DetailValues, visible: DetailField[]): string | null {
  if (visible.some((f) => !values[f].trim())) return 'wizard.details.missingError'
  if (visible.includes('iin') && !/^\d{12}$/.test(values.iin.trim())) return 'wizard.details.iinError'
  return null
}
