import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, Building2, ClipboardList, Home as HomeIcon, User } from 'lucide-react'
import { useAuth } from '../features/auth/useAuth'
import { BrandMark } from '../components/BrandMark'
import { ThemeToggle } from '../components/ThemeToggle'
import { useUnreadCount } from '../features/notifications/useUnreadCount'

type MobileSection = 'home' | 'dorm' | 'apps' | 'profile' | null

// The mobile tab bar groups every step of the application flow (wizard,
// my applications, detail, contracts, payment) into one "Өтініштер" tab,
// mirroring the design handoff's tabMap. The desktop pill nav is more
// granular — it has five separate pills for that same flow, so it gets its
// own per-route matcher below instead of reusing this section grouping.
function mobileSectionFor(pathname: string): MobileSection {
  if (pathname.startsWith('/dashboard/home')) return 'home'
  if (pathname.startsWith('/dormitories')) return 'dorm'
  if (pathname.startsWith('/applications') || pathname.startsWith('/contracts')) return 'apps'
  if (pathname.startsWith('/dashboard/profile') || pathname.startsWith('/my-residence')) return 'profile'
  if (pathname.startsWith('/notifications')) return 'home'
  return null
}

// Matches the design handoff's navMap: each desktop pill lights up only for
// its own slice of the flow (wizard vs. my-applications vs. contracts are
// three distinct pills, not one shared "apps" section).
function deskNavMatch(pathname: string, to: string): boolean {
  if (to === '/dashboard/home') return pathname.startsWith('/dashboard/home')
  if (to === '/dormitories') return pathname.startsWith('/dormitories')
  if (to === '/applications/new') return pathname.startsWith('/applications/new')
  if (to === '/applications/my') {
    return (
      pathname.startsWith('/applications/my') ||
      (/^\/applications\/[^/]+$/.test(pathname) && !pathname.startsWith('/applications/new'))
    )
  }
  if (to === '/contracts/my') return pathname.startsWith('/contracts')
  return false
}

const mobileTabs: { section: MobileSection; label: string; to: string; icon: typeof HomeIcon }[] = [
  { section: 'home', label: 'Басты', to: '/dashboard/home', icon: HomeIcon },
  { section: 'dorm', label: 'Жатақхана', to: '/dormitories', icon: Building2 },
  { section: 'apps', label: 'Өтініштер', to: '/applications/my', icon: ClipboardList },
  { section: 'profile', label: 'Профиль', to: '/dashboard/profile', icon: User },
]

const deskNav: { label: string; to: string }[] = [
  { label: 'Басты', to: '/dashboard/home' },
  { label: 'Жатақханалар', to: '/dormitories' },
  { label: 'Өтініш беру', to: '/applications/new' },
  { label: 'Менің өтініштерім', to: '/applications/my' },
  { label: 'Келісімшарт', to: '/contracts/my' },
]

function initials(fullName: string | undefined): string {
  if (!fullName) return '?'
  const parts = fullName.trim().split(/\s+/)
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

export function DashboardLayout() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const unreadCount = useUnreadCount()
  const activeMobileSection = mobileSectionFor(location.pathname)

  return (
    <div className="min-h-screen bg-navy-950 font-body pb-20 md:pb-0">
      <header className="sticky top-0 z-10 hidden border-b border-navy-700 bg-navy-900/90 backdrop-blur-sm md:block">
        <div className="mx-auto flex max-w-6xl items-center gap-5 px-9 py-4">
          <button onClick={() => navigate('/dashboard/home')} className="shrink-0">
            <BrandMark />
          </button>
          <nav className="flex flex-1 gap-1">
            {deskNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
                  deskNavMatch(location.pathname, item.to)
                    ? 'bg-turquoise-500/10 text-turquoise-400'
                    : 'text-sand-300 hover:text-sand-100'
                }`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <ThemeToggle />
          <button
            onClick={() => navigate('/notifications')}
            aria-label="Хабарламалар"
            className="relative flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-navy-700 bg-navy-900 text-sand-200"
          >
            <Bell className="h-4.5 w-4.5" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full border-2 border-navy-900 bg-clay-400" />
            )}
          </button>
          <button
            onClick={() => navigate('/dashboard/profile')}
            aria-label="Профиль"
            className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full bg-navy-800 text-sm font-bold text-sand-200"
          >
            {initials(user?.full_name)}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4 md:px-10 md:py-8">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-navy-700 bg-navy-900 px-2 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
        {mobileTabs.map(({ section, label, to, icon: Icon }) => {
          const active = section === activeMobileSection
          return (
            <NavLink
              key={to}
              to={to}
              className="flex flex-1 flex-col items-center gap-1"
            >
              <span
                className={`flex h-6.5 w-6.5 items-center justify-center rounded-[7px] ${
                  active ? 'bg-turquoise-500/15 text-turquoise-400' : 'bg-navy-800 text-sand-400'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span
                className={`text-[10px] font-bold ${active ? 'text-turquoise-400' : 'text-sand-400'}`}
              >
                {label}
              </span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
