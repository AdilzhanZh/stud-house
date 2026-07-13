import type { DormitoryType } from '../types/dormitories'

export const dormTypeLabels: Record<DormitoryType, string> = {
  sectional: 'секциялық',
  corridor: 'дәліздік',
  block: 'блоктық',
}

export function formatTenge(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return `${amount.toLocaleString('ru-RU')} ₸`
}
