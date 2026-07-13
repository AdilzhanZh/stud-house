import { useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Camera } from 'lucide-react'
import { Card } from '../../components/Card'
import { Avatar } from '../../components/Avatar'
import { Alert } from '../../components/Alert'
import { ThemeToggle } from '../../components/ThemeToggle'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { useAuth } from '../auth/useAuth'
import { useIsSettled } from '../residence/useIsSettled'
import { getStudentProfile } from '../../api/profileApi'
import { uploadFile } from '../../api/uploadApi'
import { updateAvatar } from '../../api/userApi'
import { extractErrorMessage } from '../../api/client'
import type { StudentProfile } from '../../types'

export function ProfilePage() {
  const { t } = useTranslation()
  const { user, logout, updateUser } = useAuth()
  const navigate = useNavigate()
  const isSettled = useIsSettled()
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user) return
    setAvatarError(null)
    setIsUploadingAvatar(true)
    try {
      const url = await uploadFile(file)
      const updated = await updateAvatar(user.id, url)
      updateUser(updated)
    } catch (err) {
      setAvatarError(extractErrorMessage(err, t('profile.avatarUploadFailed')))
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploadingAvatar}
          aria-label={t('profile.changeAvatar')}
          className="group relative h-15 w-15 shrink-0 rounded-full"
        >
          <Avatar fullName={user.full_name} avatarUrl={user.avatar_url} sizeClass="h-15 w-15" textClass="text-xl" />
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-navy-950/0 opacity-0 transition-all group-hover:bg-navy-950/50 group-hover:opacity-100">
            <Camera className="h-5 w-5 text-sand-100" />
          </span>
          {isUploadingAvatar && (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-navy-950/60">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-sand-100 border-t-transparent" />
            </span>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarChange}
        />
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
      {avatarError && <Alert variant="error" message={avatarError} />}

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

      <Card className="!py-1.5 !px-4.5">
        {isSettled && (
          <button
            onClick={() => navigate('/my-residence')}
            className="flex w-full items-center justify-between gap-3 border-b border-navy-700 py-3.5 text-left text-sm font-semibold text-sand-100"
          >
            <span>{t('profile.myResidence')}</span>
            <span className="text-sand-300">→</span>
          </button>
        )}
        <div className="flex items-center justify-between gap-3 border-b border-navy-700 py-3.5 text-sm font-semibold text-sand-400">
          <span>{t('profile.editData')}</span>
          <span className="text-sand-400">→</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-between gap-3 py-3.5 text-left text-sm font-semibold text-clay-400"
        >
          <span>{t('profile.logout')}</span>
          <span>→</span>
        </button>
      </Card>
    </div>
  )
}
