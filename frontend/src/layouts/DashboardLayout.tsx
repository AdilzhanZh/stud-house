import { NavLink, Outlet } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { Button } from '../components/Button'

export function DashboardLayout() {
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
          <span className="text-lg font-semibold text-gray-900">Student House</span>
          <nav className="flex items-center gap-4">
            <NavLink
              to="/dashboard/profile"
              className={({ isActive }) =>
                `text-sm font-medium ${isActive ? 'text-indigo-600' : 'text-gray-600 hover:text-gray-900'}`
              }
            >
              Профиль
            </NavLink>
            {user && <span className="text-sm text-gray-400">{user.full_name}</span>}
            <Button variant="secondary" onClick={handleLogout}>
              Шығу
            </Button>
          </nav>
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl gap-6 px-4 py-6">
        {/* Empty for now — "Өтініштер", "Хабарламалар" links land in a later phase. */}
        <aside className="w-48 shrink-0" />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
