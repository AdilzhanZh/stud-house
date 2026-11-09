import { Link, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LogIn } from 'lucide-react'
import { BrandMark } from '../components/BrandMark'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { ThemeToggle } from '../components/ThemeToggle'
import { UniversityContacts } from '../components/UniversityContacts'
import { useAuthStore } from '../store/authStore'
import { DashboardLayout } from './DashboardLayout'

// Chrome for pages anyone may open without an account (the dormitory
// catalogue): brand, language/theme and a sign-in link — none of the
// student navigation, notifications or assistant that need a session.
export function PublicLayout() {
  const { t } = useTranslation()
  const location = useLocation()

  return (
    <div className="flex min-h-screen flex-col bg-navy-950 font-body">
      <header className="on-chrome sticky top-0 z-10 border-t-[3px] border-gold-400">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 md:gap-4 md:px-9 md:py-3">
          <Link to="/dormitories" className="min-w-0 shrink">
            <BrandMark />
          </Link>
          <div className="flex-1" />
          <LanguageSwitcher />
          <ThemeToggle />
          <Link
            to="/login"
            state={{ from: location }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-turquoise-500 px-3.5 py-2 text-sm font-semibold text-navy-950 hover:bg-turquoise-400"
          >
            <LogIn className="h-4 w-4" />
            {t('auth.loginButton')}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 md:px-10 md:py-8">
        <Outlet />
      </main>

      <footer className="on-chrome">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 md:flex-row md:items-start md:justify-between md:px-9">
          <div className="max-w-sm">
            <BrandMark />
            <p className="mt-3 text-sm text-sand-300">{t('brand.university')}</p>
          </div>
          <UniversityContacts />
        </div>
      </footer>
    </div>
  )
}

// The dormitory pages are open to everyone: signed-in users keep their
// usual student chrome, visitors get the public one.
export function DormitoryBrowseLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <DashboardLayout /> : <PublicLayout />
}
