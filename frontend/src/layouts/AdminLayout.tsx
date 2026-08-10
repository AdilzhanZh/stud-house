import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
import { LanguageSwitcher } from '../components/LanguageSwitcher'
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
// doesn't cover but the app still needs (documents, protocols, committee,
// requests, users) — same visual treatment, just not the mockup's focus.
export function AdminLayout() {
  const { t } = useTranslation()
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
      <aside className="flex shrink-0 flex-col border-r border-navy-700 bg-navy-900 p-4 md:sticky md:top-0 md:h-screen md:w-62">
        <div className="flex items-center gap-2.5 px-1 pb-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center">
            <img src="/favicon.svg" alt="" className="brand-icon h-full w-full object-contain" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-sand-100">Student House</p>
            <p className="text-xs text-sand-300">
              {user?.role === 'manager' ? t('admin.layout.managerPanel') : t('admin.layout.adminPanel')}
            </p>
          </div>
        </div>

        {/* The only part that scrolls — keeps the account footer below always
            visible and in place, however many nav links there are. */}
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          <nav className="flex flex-col gap-0.5">
            <NavLink to="/admin/dashboard" className={navLinkClass}>
              <LayoutDashboard className="h-4.5 w-4.5 shrink-0" />
              {t('admin.layout.dashboard')}
            </NavLink>
            <NavLink to="/admin/applications" className={navLinkClass}>
              <ClipboardList className="h-4.5 w-4.5 shrink-0" />
              {t('admin.layout.applications')}
              <CountBadge count={pendingApplicationsCount} />
            </NavLink>
            <NavLink to="/admin/dormitories" className={navLinkClass}>
              <Building2 className="h-4.5 w-4.5 shrink-0" />
              {t('admin.layout.dormitories')}
            </NavLink>
            <NavLink to="/admin/contracts" className={navLinkClass}>
              <FileText className="h-4.5 w-4.5 shrink-0" />
              {t('admin.layout.contracts')}
            </NavLink>
            <NavLink to="/admin/residents" className={navLinkClass}>
              <Users className="h-4.5 w-4.5 shrink-0" />
              {t('admin.layout.residents')}
            </NavLink>
            <NavLink to="/admin/notifications/broadcast" className={navLinkClass}>
              <Megaphone className="h-4.5 w-4.5 shrink-0" />
              {t('admin.layout.broadcast')}
            </NavLink>
          </nav>

          <p className="mt-3 px-3 text-xs font-semibold tracking-wide text-sand-400 uppercase">
            {t('admin.layout.other')}
          </p>
          <nav className="flex flex-col gap-0.5">
            <NavLink to="/admin/documents" className={navLinkClass}>
              <FileText className="h-4.5 w-4.5 shrink-0" />
              {t('admin.layout.documents')}
            </NavLink>
            <NavLink to="/admin/protocols" className={navLinkClass}>
              <FileBarChart className="h-4.5 w-4.5 shrink-0" />
              {t('admin.layout.protocols')}
            </NavLink>
            {user?.is_committee_member && (
              <NavLink to="/committee/protocols" className={navLinkClass}>
                <Gavel className="h-4.5 w-4.5 shrink-0" />
                {t('admin.layout.committeeProtocols')}
              </NavLink>
            )}
            <NavLink to="/admin/exit-requests" className={navLinkClass}>
              <DoorOpen className="h-4.5 w-4.5 shrink-0" />
              {t('admin.layout.exitRequests')}
            </NavLink>
            <NavLink to="/admin/transfer-requests" className={navLinkClass}>
              <ArrowLeftRight className="h-4.5 w-4.5 shrink-0" />
              {t('admin.layout.transferRequests')}
            </NavLink>
            {user?.role === 'admin' && (
              <NavLink to="/admin/users" className={navLinkClass}>
                <UserCog className="h-4.5 w-4.5 shrink-0" />
                {t('admin.layout.users')}
              </NavLink>
            )}
            <NavLink to="/admin/students/pending" className={navLinkClass}>
              <UserPlus className="h-4.5 w-4.5 shrink-0" />
              {t('admin.layout.pendingStudents')}
              <CountBadge count={pendingStudentsCount} />
            </NavLink>
          </nav>
        </div>

        <div className="mt-3.5 flex shrink-0 items-center gap-2.5 border-t border-navy-700 px-1 pt-3.5">
          <Avatar fullName={user?.full_name} avatarUrl={user?.avatar_url} sizeClass="h-9 w-9" textClass="text-xs" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-sand-100">{user?.full_name}</p>
            <p className="text-xs text-sand-300">
              {user?.role === 'manager' ? t('admin.layout.managerRole') : t('admin.layout.adminRole')}
            </p>
          </div>
          <LanguageSwitcher languages={['kk', 'ru']} />
          <ThemeToggle />
        </div>
        <button
          onClick={handleLogout}
          className="shrink-0 rounded-2xl px-3 py-2 text-left text-sm font-semibold text-clay-400 hover:bg-clay-500/10"
        >
          {t('admin.layout.logout')}
        </button>
      </aside>

      <main className="min-w-0 flex-1 p-6 md:p-8">
        <Outlet />
      </main>
    </div>
  )
}
