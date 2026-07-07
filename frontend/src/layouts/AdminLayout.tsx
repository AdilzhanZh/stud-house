import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { Button } from '../components/Button'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
  }`

// Separate from DashboardLayout (student portal) per spec — admin/manager
// never see the student nav (Профиль/Менің өтініштерім/etc. don't apply to
// them; ProfilePage in particular only works for role=student).
export function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="text-lg font-semibold text-gray-900">Student House — Админ панелі</span>
          <div className="flex items-center gap-4">
            {user && (
              <span className="text-sm text-gray-400">
                {user.full_name} ({user.role === 'admin' ? 'admin' : 'manager'})
              </span>
            )}
            <Button variant="secondary" onClick={handleLogout}>
              Шығу
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        <aside className="flex w-48 shrink-0 flex-col gap-1">
          <NavLink to="/admin/applications" className={navLinkClass}>
            Өтініш кезегі
          </NavLink>
          <NavLink to="/admin/dormitories" className={navLinkClass}>
            Жатақханалар
          </NavLink>
          <NavLink to="/admin/benefits" className={navLinkClass}>
            Льготалар
          </NavLink>
          <NavLink to="/admin/report-templates" className={navLinkClass}>
            Рапорт шаблондары
          </NavLink>
          <NavLink to="/admin/reports" className={navLinkClass}>
            Рапорттар
          </NavLink>
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
          <NavLink to="/admin/users" className={navLinkClass}>
            Пайдаланушылар
          </NavLink>
        </aside>
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
