import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeftRight,
  Bell,
  Bot,
  Building2,
  ClipboardList,
  DoorOpen,
  FileBarChart,
  FileText,
  Gavel,
  LayoutDashboard,
  Megaphone,
  Menu,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '../features/auth/useAuth'
import { AssistantWidget } from '../features/assistant/AssistantWidget'
import { canManage } from '../constants/roles'
import { Avatar } from '../components/Avatar'
import { BrandLogo } from '../components/BrandMark'
import { ThemeToggle } from '../components/ThemeToggle'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { usePendingStudentsCount } from '../features/admin/users/usePendingStudentsCount'
import { usePendingApplicationsCount } from '../features/admin/applications/usePendingApplicationsCount'
import { useUnreadCount } from '../features/notifications/useUnreadCount'
import { staffPanelLabel, staffRoleLabel } from '../features/admin/staffRole'

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
    isActive ? 'bg-turquoise-500/10 text-turquoise-400' : 'text-sand-300 hover:bg-navy-800 hover:text-sand-100'
  }`
}

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-turquoise-500 px-1.5 py-0.5 text-xs font-bold text-on-accent">
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
//
// On a phone the sidebar would push every page a full screen down, so there
// it becomes a menu behind a top bar instead, with notifications and the
// profile kept one tap away in the bar itself.
export function AdminLayout() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  // Users without the manager position only see the dashboard, read-only
  // dormitories and (if elected) committee voting — every other section is
  // hidden from the nav, not just disabled.
  const isManager = canManage(user)
  const pendingStudentsCount = usePendingStudentsCount(isManager)
  const pendingApplicationsCount = usePendingApplicationsCount(isManager)
  const unreadCount = useUnreadCount()
  const panelLabel = staffPanelLabel(user, t)
  const roleLabel = staffRoleLabel(user, t)

  // Choosing a page closes the menu; so does Escape.
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-navy-950 font-body md:flex">
      <header className="on-chrome sticky top-0 z-30 flex items-center gap-2 border-t-[3px] border-gold-400 px-4 py-2.5 md:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label={t('admin.layout.openMenu')}
          aria-expanded={menuOpen}
          aria-controls="admin-menu"
          className="-ml-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sand-100 hover:bg-navy-800"
        >
          <Menu className="h-5.5 w-5.5" />
        </button>
        <button onClick={() => navigate('/admin/dashboard')} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <BrandLogo className="h-7 shrink-0" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-sand-100">Student House</span>
            <span className="block truncate text-xs text-sand-300">{panelLabel}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/admin/notifications')}
          aria-label={t('nav.notifications')}
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sand-200 hover:bg-navy-800"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full border-2 border-navy-900 bg-clay-400" />
          )}
        </button>
        <button type="button" onClick={() => navigate('/admin/profile')} aria-label={t('nav.profile')} className="shrink-0">
          <Avatar fullName={user?.full_name} avatarUrl={user?.avatar_url} sizeClass="h-9 w-9" textClass="text-xs" />
        </button>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-navy-950/70 backdrop-blur-[2px] md:hidden" onClick={() => setMenuOpen(false)} aria-hidden />
      )}

      <aside
        id="admin-menu"
        className={`on-chrome fixed inset-y-0 left-0 z-50 w-[min(18rem,85vw)] shrink-0 flex-col border-t-[3px] border-gold-400 p-4 shadow-2xl md:sticky md:top-0 md:z-auto md:flex md:h-screen md:w-62 md:shadow-none ${
          menuOpen ? 'flex' : 'hidden'
        }`}
      >
        <div className="flex items-center gap-2.5 px-1 pb-4">
          <BrandLogo className="h-8" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-sand-100">Student House</p>
            <p className="truncate text-xs text-gold-text">{t('brand.universityShort')}</p>
            <p className="text-xs text-sand-300">{panelLabel}</p>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label={t('admin.layout.closeMenu')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sand-200 hover:bg-navy-800 md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* The only part that scrolls — keeps the account footer below always
            visible and in place, however many nav links there are. */}
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          <nav className="flex flex-col gap-0.5">
            <NavLink to="/admin/dashboard" className={navLinkClass}>
              <LayoutDashboard className="h-4.5 w-4.5 shrink-0" />
              {t('admin.layout.dashboard')}
            </NavLink>
            {isManager && (
              <NavLink to="/admin/applications" className={navLinkClass}>
                <ClipboardList className="h-4.5 w-4.5 shrink-0" />
                {t('admin.layout.applications')}
                <CountBadge count={pendingApplicationsCount} />
              </NavLink>
            )}
            <NavLink to="/admin/dormitories" className={navLinkClass}>
              <Building2 className="h-4.5 w-4.5 shrink-0" />
              {t('admin.layout.dormitories')}
            </NavLink>
            {isManager && (
              <>
                <NavLink to="/admin/contracts" className={navLinkClass}>
                  <FileText className="h-4.5 w-4.5 shrink-0" />
                  {t('admin.layout.contracts')}
                </NavLink>
                <NavLink to="/admin/residents" end className={navLinkClass}>
                  <Users className="h-4.5 w-4.5 shrink-0" />
                  {t('admin.layout.residents')}
                </NavLink>
                <NavLink to="/admin/residents/place" className={navLinkClass}>
                  <UserCheck className="h-4.5 w-4.5 shrink-0" />
                  {t('admin.layout.placeStudent')}
                </NavLink>
                <NavLink to="/admin/notifications/broadcast" className={navLinkClass}>
                  <Megaphone className="h-4.5 w-4.5 shrink-0" />
                  {t('admin.layout.broadcast')}
                </NavLink>
              </>
            )}
            <NavLink to="/admin/notifications" end className={navLinkClass}>
              <Bell className="h-4.5 w-4.5 shrink-0" />
              {t('nav.notifications')}
              <CountBadge count={unreadCount} />
            </NavLink>
          </nav>

          {(isManager || user?.is_committee_member) && (
            <p className="mt-3 px-3 text-xs font-semibold tracking-wide text-sand-400 uppercase">
              {t('admin.layout.other')}
            </p>
          )}
          <nav className="flex flex-col gap-0.5">
            {isManager && (
              <>
                <NavLink to="/admin/documents" className={navLinkClass}>
                  <FileText className="h-4.5 w-4.5 shrink-0" />
                  {t('admin.layout.documents')}
                </NavLink>
                <NavLink to="/admin/protocols" className={navLinkClass}>
                  <FileBarChart className="h-4.5 w-4.5 shrink-0" />
                  {t('admin.layout.protocols')}
                </NavLink>
              </>
            )}
            {user?.is_committee_member && (
              <NavLink to="/committee/protocols" className={navLinkClass}>
                <Gavel className="h-4.5 w-4.5 shrink-0" />
                {t('admin.layout.committeeProtocols')}
              </NavLink>
            )}
            {isManager && (
              <>
                <NavLink to="/admin/exit-requests" className={navLinkClass}>
                  <DoorOpen className="h-4.5 w-4.5 shrink-0" />
                  {t('admin.layout.exitRequests')}
                </NavLink>
                <NavLink to="/admin/transfer-requests" className={navLinkClass}>
                  <ArrowLeftRight className="h-4.5 w-4.5 shrink-0" />
                  {t('admin.layout.transferRequests')}
                </NavLink>
                <NavLink to="/admin/users" className={navLinkClass}>
                  <UserCog className="h-4.5 w-4.5 shrink-0" />
                  {t('admin.layout.users')}
                </NavLink>
                <NavLink to="/admin/students/pending" className={navLinkClass}>
                  <UserPlus className="h-4.5 w-4.5 shrink-0" />
                  {t('admin.layout.pendingStudents')}
                  <CountBadge count={pendingStudentsCount} />
                </NavLink>
              </>
            )}
            {user?.role === 'admin' && (
              <NavLink to="/admin/ai-settings" className={navLinkClass}>
                <Bot className="h-4.5 w-4.5 shrink-0" />
                {t('admin.layout.aiSettings')}
              </NavLink>
            )}
          </nav>
        </div>

        <div className="mt-3.5 flex shrink-0 items-center gap-2.5 border-t border-navy-700 px-1 pt-3.5">
          <NavLink
            to="/admin/profile"
            className="-m-1 flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1 hover:bg-navy-800"
            title={t('nav.profile')}
          >
            <Avatar fullName={user?.full_name} avatarUrl={user?.avatar_url} sizeClass="h-9 w-9" textClass="text-xs" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-sand-100">{user?.full_name}</span>
              <span className="block truncate text-xs text-sand-300">{roleLabel}</span>
            </span>
          </NavLink>
          <LanguageSwitcher languages={['kk', 'ru']} dropUp />
          <ThemeToggle />
        </div>
        <button
          onClick={handleLogout}
          className="shrink-0 rounded-2xl px-3 py-2 text-left text-sm font-semibold text-clay-400 hover:bg-clay-500/10"
        >
          {t('admin.layout.logout')}
        </button>
      </aside>

      <main className="min-w-0 flex-1 p-4 sm:p-6 md:p-8">
        <Outlet />
      </main>

      <AssistantWidget />
    </div>
  )
}
