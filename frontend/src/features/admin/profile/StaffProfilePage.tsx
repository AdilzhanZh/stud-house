import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LogOut, Pencil } from 'lucide-react'
import { Avatar } from '../../../components/Avatar'
import { Card } from '../../../components/Card'
import { LanguageSwitcher } from '../../../components/LanguageSwitcher'
import { ThemeToggle } from '../../../components/ThemeToggle'
import { useAuth } from '../../auth/useAuth'
import { AppOnPhoneCard } from '../../profile/AppOnPhoneCard'
import { staffPositionLabels, staffRoleLabel } from '../staffRole'

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-3 py-3.5 text-sm">
      <dt className="shrink-0 text-sand-300">{label}</dt>
      <dd className="min-w-0 text-right font-semibold break-words text-sand-100">{value?.trim() || '—'}</dd>
    </div>
  )
}

// The account page for admins, managers and other staff: who they are, the
// app-on-phone switches, and the account actions. The student profile holds
// study details staff don't have, so this is its own page.
export function StaffProfilePage() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null
  const positions = staffPositionLabels(user, t)

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex max-w-2xl flex-col gap-3.5">
      <div className="flex items-center gap-3.5">
        <Avatar fullName={user.full_name} avatarUrl={user.avatar_url} sizeClass="h-15 w-15" textClass="text-xl" />
        <div className="min-w-0">
          <p className="text-xl font-bold break-words text-sand-100">{user.full_name}</p>
          <p className="mt-0.5 text-sm text-sand-300">{[staffRoleLabel(user, t), ...positions].join(' · ')}</p>
        </div>
      </div>

      <Card className="!py-1.5 !px-4.5">
        <dl className="divide-y divide-navy-700">
          <Row label={t('profile.email')} value={user.email} />
          <Row label={t('profile.phone')} value={user.phone} />
        </dl>
      </Card>

      <AppOnPhoneCard />

      {/* The sidebar has these on a wide screen; on a phone it's a menu away. */}
      <Card className="!py-1.5 !px-4.5 md:hidden">
        <div className="flex items-center justify-between gap-3 border-b border-navy-700 py-3.5 text-sm font-semibold text-sand-100">
          <span>{t('profile.theme')}</span>
          <ThemeToggle />
        </div>
        <div className="flex items-center justify-between gap-3 py-3.5 text-sm font-semibold text-sand-100">
          <span>{t('profile.language')}</span>
          <LanguageSwitcher languages={['kk', 'ru']} />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => navigate('/admin/profile/edit')}
          className="flex flex-col gap-2.5 rounded-[20px] bg-navy-900 p-3.5 text-left shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5"
        >
          <span className="flex h-8.5 w-8.5 items-center justify-center rounded-full bg-navy-800">
            <Pencil className="h-4 w-4 text-turquoise-400" />
          </span>
          <span className="text-sm font-semibold text-sand-100">{t('profile.editData')}</span>
        </button>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="flex flex-col gap-2.5 rounded-[20px] bg-navy-900 p-3.5 text-left shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5"
        >
          <span className="flex h-8.5 w-8.5 items-center justify-center rounded-full bg-clay-500/15">
            <LogOut className="h-4 w-4 text-clay-400" />
          </span>
          <span className="text-sm font-semibold text-clay-400">{t('profile.logout')}</span>
        </button>
      </div>
    </div>
  )
}
