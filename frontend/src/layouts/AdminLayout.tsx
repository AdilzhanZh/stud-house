import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { Button } from '../components/Button'
import { BrandMark } from '../components/BrandMark'
import { ThemeToggle } from '../components/ThemeToggle'
import { usePendingStudentsCount } from '../features/admin/users/usePendingStudentsCount'
import { usePendingApplicationsCount } from '../features/admin/applications/usePendingApplicationsCount'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-turquoise-500/10 text-turquoise-300 ring-1 ring-inset ring-turquoise-400/20'
      : 'text-sand-300/70 hover:bg-sand-100/5 hover:text-sand-100'
  }`

// Separate from DashboardLayout (student portal) per spec — admin/manager
// never see the student nav (Профиль/Менің өтініштерім/etc. don't apply to
// them; ProfilePage in particular only works for role=student).
export function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const pendingStudentsCount = usePendingStudentsCount()
  const pendingApplicationsCount = usePendingApplicationsCount()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-navy-950 font-body">
      <header className="sticky top-0 z-10 border-b border-sand-100/10 bg-navy-900/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <BrandMark label={user?.role === 'manager' ? 'Менеджер панелі' : 'Админ панелі'} />
          <div className="flex items-center gap-4">
            {user && (
              <span className="text-sm text-sand-300/70">
                {user.full_name} ({user.role === 'admin' ? 'admin' : 'manager'})
              </span>
            )}
            <ThemeToggle />
            <Button variant="secondary" onClick={handleLogout}>
              Шығу
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        <aside className="flex w-48 shrink-0 flex-col gap-1">
          <NavLink to="/admin/applications" className={navLinkClass}>
            <span className="inline-flex items-center gap-2">
              Өтініш кезегі
              {pendingApplicationsCount > 0 && (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-turquoise-500 px-1.5 py-0.5 text-xs font-semibold text-ink">
                  {pendingApplicationsCount}
                </span>
              )}
            </span>
          </NavLink>
          <NavLink to="/admin/dormitories" className={navLinkClass}>
            Жатақханалар
          </NavLink>
          <NavLink to="/admin/documents" className={navLinkClass}>
            Құжаттар
          </NavLink>
          <NavLink to="/admin/reports" className={navLinkClass}>
            Рапорттар
          </NavLink>
          {user?.is_committee_member && (
            <NavLink to="/committee/reports" className={navLinkClass}>
              Комиссия рапорттары
            </NavLink>
          )}
          <NavLink to="/admin/contracts" className={navLinkClass}>
            Келісімшарттар
          </NavLink>
          <NavLink to="/admin/payments" className={navLinkClass}>
            Төлемдер
          </NavLink>
          <NavLink to="/admin/exit-requests" className={navLinkClass}>
            Шығу сұраныстары
          </NavLink>
          <NavLink to="/admin/transfer-requests" className={navLinkClass}>
            Ауыстыру сұраныстары
          </NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/admin/users" className={navLinkClass}>
              Пайдаланушылар
            </NavLink>
          )}
          <NavLink to="/admin/students/pending" className={navLinkClass}>
            <span className="inline-flex items-center gap-2">
              Күтіп тұрған тіркелгілер
              {pendingStudentsCount > 0 && (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-turquoise-500 px-1.5 py-0.5 text-xs font-semibold text-ink">
                  {pendingStudentsCount}
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
