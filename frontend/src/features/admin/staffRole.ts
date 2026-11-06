import type { TFunction } from 'i18next'
import { canManage } from '../../constants/roles'
import type { User } from '../../types'

// How a staff account is named: "Admin panel" / "Dormitory manager" and so
// on, shared by the admin sidebar and the staff profile so they always agree.
export function staffPanelLabel(user: User | null, t: TFunction): string {
  if (user?.role === 'admin') return t('admin.layout.adminPanel')
  return canManage(user) ? t('admin.layout.managerPanel') : t('admin.layout.userPanel')
}

export function staffRoleLabel(user: User | null, t: TFunction): string {
  if (user?.role === 'admin') return t('admin.layout.adminRole')
  return canManage(user) ? t('admin.layout.managerRole') : t('admin.layout.userRole')
}

// Admin-granted positions held on top of the role (role=user only).
export function staffPositionLabels(user: User | null, t: TFunction): string[] {
  if (!user || user.role !== 'user') return []
  return [
    user.is_committee_member && t('admin.users.committeeMember'),
    user.is_chairperson && t('admin.users.chairperson'),
  ].filter((label): label is string => Boolean(label))
}
