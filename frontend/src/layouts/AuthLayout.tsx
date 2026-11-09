import { Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BrandLogo, BrandMark } from '../components/BrandMark'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { SectionEyebrow } from '../components/SectionEyebrow'
import { ThemeToggle } from '../components/ThemeToggle'
import { UniversityContacts } from '../components/UniversityContacts'
import { DormitoryMarquee } from '../features/dormitories/DormitoryMarquee'
import { useDormitoriesWithMeta } from '../features/dormitories/useDormitoriesWithMeta'

// Shared by /login and /register. The first screen anyone sees, so it carries
// the university's name and contacts: a side panel on wide screens, a slim band
// on phones. The login screen also shows a moving strip of the dormitories,
// which anyone may browse without an account.
export function AuthLayout() {
  const isLogin = useLocation().pathname === '/login'
  return <AuthChrome showDorms={isLogin} />
}

function AuthChrome({ showDorms }: { showDorms: boolean }) {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-navy-950 font-body text-sand-100 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="on-chrome hidden min-h-screen flex-col justify-between overflow-hidden border-t-[3px] border-gold-400 px-12 py-10 lg:flex">
        <BrandLogo full className={`${showDorms ? 'h-24' : 'h-44'} self-start`} />
        <div className="max-w-md">
          <SectionEyebrow>Student House</SectionEyebrow>
          <h1 className={`mt-3 ${showDorms ? 'text-[26px]' : 'text-[32px]'} leading-tight font-bold text-sand-100`}>{t('brand.university')}</h1>
          {!showDorms && <p className="mt-3 text-base text-sand-200">{t('auth.tagline')}</p>}
        </div>
        {showDorms && <DormsStrip className="my-3" />}
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
          {showDorms && <DormsStrip className="mt-10 lg:hidden" />}
        </div>
      </div>
    </div>
  )
}

// Rendered in the side panel on wide screens and under the form on phones;
// only one of the two is visible at a time.
function DormsStrip({ className }: { className: string }) {
  const { dormitories, error } = useDormitoriesWithMeta()
  if (error) return null
  return (
    <div className={className}>
      <DormitoryMarquee dormitories={dormitories} />
    </div>
  )
}
