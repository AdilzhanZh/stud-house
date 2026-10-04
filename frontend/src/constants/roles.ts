import type { Role, User } from '../types'

export const roleLabels: Record<Role, string> = {
  admin: 'Админ',
  user: 'Пайдаланушы',
  student: 'Студент',
}

// Full management access: the admin, or a user holding the manager position.
// A user without it only gets read-only dormitories (plus committee voting
// if elected) — mirrors the backend's domain.CanManage.
export function canManage(user: Pick<User, 'role' | 'is_manager'> | null | undefined): boolean {
  return user?.role === 'admin' || (user?.role === 'user' && user.is_manager)
}
