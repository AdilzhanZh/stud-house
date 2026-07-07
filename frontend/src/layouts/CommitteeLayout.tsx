import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { Button } from '../components/Button'

// committee_member gets its own minimal layout — separate from both
// DashboardLayout (student) and AdminLayout (admin/manager, which
// deliberately excludes this role): per spec, only "Комиссия рапорттары"
// is shown for this role.
export function CommitteeLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="text-lg font-semibold text-gray-900">Student House — Комиссия</span>
          <div className="flex items-center gap-4">
            {user && <span className="text-sm text-gray-400">{user.full_name}</span>}
            <Button variant="secondary" onClick={handleLogout}>
              Шығу
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl gap-6 px-4 py-6">
        <aside className="flex w-48 shrink-0 flex-col gap-1">
          <NavLink
            to="/committee/reports"
            className={({ isActive }) =>
              `rounded-md px-3 py-2 text-sm font-medium ${
                isActive ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            Комиссия рапорттары
          </NavLink>
        </aside>
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
