import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { Button } from '../components/Button'
import { useUnreadCount } from '../features/notifications/useUnreadCount'
import { useIsSettled } from '../features/residence/useIsSettled'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
  }`

export function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const unreadCount = useUnreadCount()
  const isSettled = useIsSettled()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="text-lg font-semibold text-gray-900">Student House</span>
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
          <NavLink to="/dashboard/profile" className={navLinkClass}>
            Профиль
          </NavLink>
          <NavLink to="/dormitories" className={navLinkClass}>
            Жатақханалар
          </NavLink>
          <NavLink to="/applications/my" className={navLinkClass}>
            Менің өтініштерім
          </NavLink>
          <NavLink to="/contracts/my" className={navLinkClass}>
            Келісімшарттарым
          </NavLink>
          {isSettled && (
            <NavLink to="/my-residence" className={navLinkClass}>
              Менің орналасуым
            </NavLink>
          )}
          <NavLink to="/notifications" className={navLinkClass}>
            <span className="inline-flex items-center gap-2">
              Хабарламалар
              {unreadCount > 0 && (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 py-0.5 text-xs font-semibold text-white">
                  {unreadCount}
                </span>
              )}
            </span>
          </NavLink>
        </aside>
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
