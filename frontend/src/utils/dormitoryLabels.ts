import type { TFunction } from 'i18next'
import type { DormitoryType } from '../types/dormitories'

export function dormTypeLabel(type: DormitoryType, t: TFunction): string {
  return t(`dorm.types.${type}`)
}

export function formatTenge(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return `${amount.toLocaleString('ru-RU')} ₸`
}
