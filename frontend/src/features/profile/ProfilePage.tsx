import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Pencil, LogOut } from 'lucide-react'
import { Card } from '../../components/Card'
import { Avatar } from '../../components/Avatar'
import { ThemeToggle } from '../../components/ThemeToggle'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { useAuth } from '../auth/useAuth'
import { useIsSettled } from '../residence/useIsSettled'
import { getStudentProfile } from '../../api/profileApi'
import type { StudentProfile } from '../../types'

export function ProfilePage() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const isSettled = useIsSettled()
  const [profile, setProfile] = useState<StudentProfile | null>(null)

  const degreeLabels: Record<NonNullable<StudentProfile['academic_degree']>, string> = {
    bachelor: t('auth.bachelor'),
    master: t('auth.master'),
  }

  const genderLabels: Record<NonNullable<StudentProfile['gender']>, string> = {
    male: t('auth.male'),
    female: t('auth.female'),
  }

  useEffect(() => {
    if (!user) return
    getStudentProfile(user.id)
      .then(setProfile)
      .catch(() => setProfile(null))
  }, [user])

  if (!user) return null

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3.5">
        <Avatar fullName={user.full_name} avatarUrl={user.avatar_url} sizeClass="h-15 w-15" textClass="text-xl" />
        <div>
          <p className="text-xl font-bold text-sand-100">{user.full_name}</p>
          {profile?.academic_degree && (
            <p className="mt-0.5 text-sm text-sand-300">
              {degreeLabels[profile.academic_degree]}
              {profile.course != null && ` · ${t('profile.course', { course: profile.course })}`}
            </p>
          )}
        </div>
      </div>

      <Card className="!py-1.5 !px-4.5">
        <div className="flex justify-between gap-3 border-b border-navy-700 py-3.5 text-sm">
          <span className="text-sand-300">{t('profile.email')}</span>
          <span className="font-semibold text-sand-100">{user.email}</span>
        </div>
        <div className="flex justify-between gap-3 border-b border-navy-700 py-3.5 text-sm">
          <span className="text-sand-300">{t('profile.phone')}</span>
          <span className="font-semibold text-sand-100">{user.phone || '—'}</span>
        </div>
        <div className="flex justify-between gap-3 border-b border-navy-700 py-3.5 text-sm">
          <span className="text-sand-300">{t('profile.iin')}</span>
          <span className="font-semibold text-sand-100">{user.iin || '—'}</span>
        </div>
        <div className="flex justify-between gap-3 py-3.5 text-sm">
          <span className="text-sand-300">{t('profile.gender')}</span>
          <span className="font-semibold text-sand-100">
            {profile?.gender ? genderLabels[profile.gender] : '—'}
          </span>
        </div>
      </Card>

      <Card className="!py-1.5 !px-4.5 md:hidden">
        <div className="flex items-center justify-between gap-3 border-b border-navy-700 py-3.5 text-sm font-semibold text-sand-100">
          <span>{t('profile.theme')}</span>
          <ThemeToggle />
        </div>
        <div className="flex items-center justify-between gap-3 py-3.5 text-sm font-semibold text-sand-100">
          <span>{t('profile.language')}</span>
          <LanguageSwitcher />
        </div>
      </Card>

      {isSettled && (
        <Card className="!py-1.5 !px-4.5">
          <button
            onClick={() => navigate('/my-residence')}
            className="flex w-full items-center justify-between gap-3 py-3.5 text-left text-sm font-semibold text-sand-100"
          >
            <span>{t('profile.myResidence')}</span>
            <span className="text-sand-300">→</span>
          </button>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card onClick={() => navigate('/dashboard/profile/edit')} className="!p-3.5 flex flex-col gap-2.5">
          <span className="flex h-8.5 w-8.5 items-center justify-center rounded-full bg-navy-800">
            <Pencil className="h-4 w-4 text-turquoise-400" />
          </span>
          <span className="text-sm font-semibold text-sand-100">{t('profile.editData')}</span>
        </Card>
        <Card onClick={handleLogout} className="!p-3.5 flex flex-col gap-2.5">
          <span className="flex h-8.5 w-8.5 items-center justify-center rounded-full bg-clay-500/15">
            <LogOut className="h-4 w-4 text-clay-400" />
          </span>
          <span className="text-sm font-semibold text-clay-400">{t('profile.logout')}</span>
        </Card>
      </div>
    </div>
  )
}
