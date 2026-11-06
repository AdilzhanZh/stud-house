import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Pencil, LogOut } from 'lucide-react'
import { Card } from '../../components/Card'
import { Avatar } from '../../components/Avatar'
import { ThemeToggle } from '../../components/ThemeToggle'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { useAuth } from '../auth/useAuth'
import { useIsSettled } from '../residence/useIsSettled'
import { AppOnPhoneCard } from './AppOnPhoneCard'
import { getStudentProfile } from '../../api/profileApi'
import type { StudentProfile } from '../../types'

function ProfileSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      {title && <h2 className="px-1 text-[13px] font-semibold tracking-wide text-sand-300 uppercase">{title}</h2>}
      <Card className="!py-1.5 !px-4.5">
        <dl className="divide-y divide-navy-700">{children}</dl>
      </Card>
    </section>
  )
}

function ProfileRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-3 py-3.5 text-sm">
      <dt className="shrink-0 text-sand-300">{label}</dt>
      <dd className="min-w-0 text-right font-semibold break-words text-sand-100">{value?.trim() || '—'}</dd>
    </div>
  )
}

export function ProfilePage() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const isSettled = useIsSettled()
  const [profile, setProfile] = useState<StudentProfile | null>(null)

  const degreeLabels: Record<NonNullable<StudentProfile['academic_degree']>, string> = {
    bachelor: t('auth.bachelor'),
    master: t('auth.master'),
    doctorate: t('auth.doctorate'),
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

  const isStudent = user.role === 'student'
  // Everything the contract, petition and referral are filled from that the
  // student can see; the rest (name, gender, room) is always set.
  const documentFields = [
    user.phone,
    user.iin,
    profile?.institute,
    profile?.study_group,
    profile?.hometown,
    profile?.parent_contact,
  ]
  const filledCount = documentFields.filter((v) => v?.trim()).length

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

      {isStudent && profile && filledCount < documentFields.length && (
        <button
          type="button"
          onClick={() => navigate('/dashboard/profile/edit')}
          className="flex w-full items-center justify-between gap-3 rounded-[20px] border border-amber-500/30 bg-amber-500/10 px-4.5 py-3.5 text-left"
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-sand-100">
              {t('profile.detailsProgress', { filled: filledCount, total: documentFields.length })}
            </span>
            <span className="mt-0.5 block text-xs text-sand-300">{t('profile.detailsProgressHint')}</span>
          </span>
          <span className="shrink-0 text-sm font-semibold text-turquoise-400">{t('profile.fillDetails')}</span>
        </button>
      )}

      <ProfileSection title={isStudent ? t('profile.personalSection') : undefined}>
        <ProfileRow label={t('profile.email')} value={user.email} />
        <ProfileRow label={t('profile.phone')} value={user.phone} />
        <ProfileRow label={t('profile.iin')} value={user.iin} />
        {isStudent && (
          <>
            <ProfileRow label={t('profile.gender')} value={profile?.gender ? genderLabels[profile.gender] : null} />
            <ProfileRow label={t('profile.hometown')} value={profile?.hometown} />
            <ProfileRow label={t('profile.parentContact')} value={profile?.parent_contact} />
          </>
        )}
      </ProfileSection>

      {isStudent && (
        <ProfileSection title={t('profile.studySection')}>
          <ProfileRow
            label={t('profile.degree')}
            value={profile?.academic_degree ? degreeLabels[profile.academic_degree] : null}
          />
          <ProfileRow label={t('profile.courseLabel')} value={profile?.course != null ? String(profile.course) : null} />
          <ProfileRow label={t('profile.institute')} value={profile?.institute} />
          <ProfileRow label={t('profile.studyGroup')} value={profile?.study_group} />
        </ProfileSection>
      )}
      {isStudent && <p className="-mt-1.5 px-1 text-xs text-sand-300">{t('profile.lockedHint')}</p>}

      <AppOnPhoneCard />

      <Card className="!py-1.5 !px-4.5">
        <button
          onClick={() => navigate('/dashboard/profile/feedback')}
          className="flex w-full items-center justify-between gap-3 py-3.5 text-left text-sm font-semibold text-sand-100"
        >
          <span>{t('profile.feedbackTitle')}</span>
          <span className="text-sand-300">→</span>
        </button>
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
