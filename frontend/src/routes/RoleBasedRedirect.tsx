import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

// ProfilePage (student-only: gender/course) errors out for admin/manager —
// UserService.UpsertStudentProfile/GetStudentProfile only make sense for
// role=student. So the default landing route differs by role instead of
// always going to /dashboard/home.
export function RoleBasedRedirect() {
  const role = useAuthStore((s) => s.user?.role)
  if (role === 'manager' || role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />
  }
  return <Navigate to="/dashboard/home" replace />
}
