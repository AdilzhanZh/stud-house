import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import type { Role } from '../types'

interface ProtectedRouteProps {
  // Only student is used this phase, but the role gate is here for when
  // manager/admin panels land in a later phase.
  allowedRoles?: Role[]
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const role = useAuthStore((s) => s.user?.role)
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/dashboard/profile" replace />
  }
  return <Outlet />
}
