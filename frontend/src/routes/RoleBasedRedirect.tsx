import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

// ProfilePage (student-only: gender/course) errors out for admin/manager —
// UserService.UpsertStudentProfile/GetStudentProfile only make sense for
// role=student. So the default landing route differs by role instead of
// always going to /dashboard/profile.
export function RoleBasedRedirect() {
  const role = useAuthStore((s) => s.user?.role)
  if (role === 'admin' || role === 'manager') {
    return <Navigate to="/admin/dormitories" replace />
  }
  if (role === 'committee_member') {
    return <Navigate to="/committee/reports" replace />
  }
  return <Navigate to="/dashboard/profile" replace />
}
