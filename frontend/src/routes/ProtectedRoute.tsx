import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import type { Role, User } from '../types'

interface ProtectedRouteProps {
  allowedRoles?: Role[]
  // Extra gate for staff routes that depend on positions (manager,
  // committee member) rather than role alone. A staff user failing it is
  // sent back to the admin dashboard, which every staff user can see.
  allow?: (user: User) => boolean
}

export function ProtectedRoute({ allowedRoles, allow }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const role = user?.role
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/dashboard/profile" replace />
  }
  if (allow && user && !allow(user)) {
    return <Navigate to="/admin/dashboard" replace />
  }
  return <Outlet />
}
