import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { Button } from '../components/Button'
import { BrandMark } from '../components/BrandMark'
import { ThemeToggle } from '../components/ThemeToggle'
import { useUnreadCount } from '../features/notifications/useUnreadCount'
import { useIsSettled } from '../features/residence/useIsSettled'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-turquoise-500/10 text-turquoise-300 ring-1 ring-inset ring-turquoise-400/20'
      : 'text-sand-300/70 hover:bg-sand-100/5 hover:text-sand-100'
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
    <div className="min-h-screen bg-navy-950 font-body">
      <header className="sticky top-0 z-10 border-b border-sand-100/10 bg-navy-900/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <BrandMark />
          <div className="flex items-center gap-4">
            {user && <span className="text-sm text-sand-300/70">{user.full_name}</span>}
            <ThemeToggle />
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
          <NavLink to="/applications/new" className={navLinkClass}>
            Өтініш беру
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
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-turquoise-500 px-1.5 py-0.5 text-xs font-semibold text-ink">
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
