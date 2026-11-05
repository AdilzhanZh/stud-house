import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BrandLogo, BrandMark } from '../components/BrandMark'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { SectionEyebrow } from '../components/SectionEyebrow'
import { ThemeToggle } from '../components/ThemeToggle'
import { UniversityContacts } from '../components/UniversityContacts'

// Shared by /login and /register. The first screen anyone sees, so it carries
// the university's name and contacts: a side panel on wide screens, a slim band
// on phones.
export function AuthLayout() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-navy-950 font-body text-sand-100 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="on-chrome hidden min-h-screen flex-col justify-between overflow-hidden border-t-[3px] border-gold-400 p-12 lg:flex">
        <BrandLogo full className="h-44 self-start" />
        <div className="max-w-md">
          <SectionEyebrow>Student House</SectionEyebrow>
          <h1 className="mt-3 text-[32px] leading-tight font-bold text-sand-100">{t('brand.university')}</h1>
          <p className="mt-3 text-base text-sand-200">{t('auth.tagline')}</p>
        </div>
        <UniversityContacts />
      </aside>

      <div className="flex min-h-screen flex-col">
        <div className="on-chrome border-t-[3px] border-gold-400 px-6 py-3 lg:hidden">
          <BrandMark />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-10">
          <div className="mb-8 flex items-center justify-end gap-1.5">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
