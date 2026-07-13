import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  ArrowLeftRight,
  Building2,
  ClipboardList,
  DoorOpen,
  FileBarChart,
  FileText,
  Gavel,
  LayoutDashboard,
  Megaphone,
  UserCog,
  UserPlus,
  Users,
} from 'lucide-react'
import { useAuth } from '../features/auth/useAuth'
import { Avatar } from '../components/Avatar'
import { ThemeToggle } from '../components/ThemeToggle'
import { usePendingStudentsCount } from '../features/admin/users/usePendingStudentsCount'
import { usePendingApplicationsCount } from '../features/admin/applications/usePendingApplicationsCount'

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors ${
    isActive ? 'bg-turquoise-500/10 text-turquoise-400' : 'text-sand-300 hover:bg-navy-800 hover:text-sand-100'
  }`
}

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-turquoise-500 px-1.5 py-0.5 text-xs font-bold text-ink">
      {count}
    </span>
  )
}

// Separate from DashboardLayout (student portal) per spec — admin/manager
// never see the student nav. Keeps a sidebar shape (unlike the student
// portal's top+bottom nav) since a dense admin panel reads better as a
// sidebar. Split into a primary group (the "Админ панелі" hifi mockup's 6
// screens) and a secondary group below a divider for everything the mockup
// doesn't cover but the app still needs (documents, reports, committee,
// requests, users) — same visual treatment, just not the mockup's focus.
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
    <div className="min-h-screen bg-navy-950 font-body md:flex">
      <aside className="flex shrink-0 flex-col gap-1 border-r border-navy-700 bg-navy-900 p-4 md:w-62">
        <div className="flex items-center gap-2.5 px-1 pb-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center">
            <img src="/favicon.svg" alt="" className="brand-icon h-full w-full object-contain" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-sand-100">Student House</p>
            <p className="text-xs text-sand-300">{user?.role === 'manager' ? 'Менеджер панелі' : 'Админ панелі'}</p>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5">
          <NavLink to="/admin/dashboard" className={navLinkClass}>
            <LayoutDashboard className="h-4.5 w-4.5 shrink-0" />
            Дашборд
          </NavLink>
          <NavLink to="/admin/applications" className={navLinkClass}>
            <ClipboardList className="h-4.5 w-4.5 shrink-0" />
            Өтініштер
            <CountBadge count={pendingApplicationsCount} />
          </NavLink>
          <NavLink to="/admin/dormitories" className={navLinkClass}>
            <Building2 className="h-4.5 w-4.5 shrink-0" />
            Жатақханалар
          </NavLink>
          <NavLink to="/admin/contracts" className={navLinkClass}>
            <FileText className="h-4.5 w-4.5 shrink-0" />
            Келісімшарттар мен төлемдер
          </NavLink>
          <NavLink to="/admin/residents" className={navLinkClass}>
            <Users className="h-4.5 w-4.5 shrink-0" />
            Тұрғындар
          </NavLink>
          <NavLink to="/admin/notifications/broadcast" className={navLinkClass}>
            <Megaphone className="h-4.5 w-4.5 shrink-0" />
            Хабарландыру
          </NavLink>
        </nav>

        <p className="mt-3 px-3 text-xs font-semibold tracking-wide text-sand-400 uppercase">Басқа</p>
        <nav className="flex flex-col gap-0.5">
          <NavLink to="/admin/documents" className={navLinkClass}>
            <FileText className="h-4.5 w-4.5 shrink-0" />
            Құжаттар
          </NavLink>
          <NavLink to="/admin/reports" className={navLinkClass}>
            <FileBarChart className="h-4.5 w-4.5 shrink-0" />
            Рапорттар
          </NavLink>
          {user?.is_committee_member && (
            <NavLink to="/committee/reports" className={navLinkClass}>
              <Gavel className="h-4.5 w-4.5 shrink-0" />
              Комиссия рапорттары
            </NavLink>
          )}
          <NavLink to="/admin/exit-requests" className={navLinkClass}>
            <DoorOpen className="h-4.5 w-4.5 shrink-0" />
            Шығу сұраныстары
          </NavLink>
          <NavLink to="/admin/transfer-requests" className={navLinkClass}>
            <ArrowLeftRight className="h-4.5 w-4.5 shrink-0" />
            Ауыстыру сұраныстары
          </NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/admin/users" className={navLinkClass}>
              <UserCog className="h-4.5 w-4.5 shrink-0" />
              Пайдаланушылар
            </NavLink>
          )}
          <NavLink to="/admin/students/pending" className={navLinkClass}>
            <UserPlus className="h-4.5 w-4.5 shrink-0" />
            Күтіп тұрған тіркелгілер
            <CountBadge count={pendingStudentsCount} />
          </NavLink>
        </nav>

        <span className="flex-1" />
        <div className="flex items-center gap-2.5 border-t border-navy-700 px-1 pt-3.5">
          <Avatar fullName={user?.full_name} avatarUrl={user?.avatar_url} sizeClass="h-9 w-9" textClass="text-xs" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-sand-100">{user?.full_name}</p>
            <p className="text-xs text-sand-300">{user?.role === 'manager' ? 'Жатақхана менеджері' : 'Әкімші'}</p>
          </div>
          <ThemeToggle />
        </div>
        <button
          onClick={handleLogout}
          className="rounded-2xl px-3 py-2 text-left text-sm font-semibold text-clay-400 hover:bg-clay-500/10"
        >
          Шығу
        </button>
      </aside>

      <main className="min-w-0 flex-1 p-6 md:p-8">
        <Outlet />
      </main>
    </div>
  )
}
