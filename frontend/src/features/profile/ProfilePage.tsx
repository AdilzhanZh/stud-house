import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Pencil, LogOut } from 'lucide-react'
import { Card } from '../../components/Card'
import { Avatar } from '../../components/Avatar'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import { ThemeToggle } from '../../components/ThemeToggle'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { extractErrorMessage } from '../../api/client'
import { sendFeedback } from '../../api/feedbackApi'
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

  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)
  const [isSendingFeedback, setIsSendingFeedback] = useState(false)

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

  async function handleSendFeedback(e: React.FormEvent) {
    e.preventDefault()
    setFeedbackError(null)
    setIsSendingFeedback(true)
    try {
      await sendFeedback(feedbackMessage.trim())
      setFeedbackMessage('')
      setFeedbackSent(true)
    } catch (err) {
      setFeedbackError(extractErrorMessage(err, t('profile.feedbackFailed')))
    } finally {
      setIsSendingFeedback(false)
    }
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

      <Card>
        <p className="text-[15px] font-bold text-sand-100">{t('profile.feedbackTitle')}</p>
        <p className="mt-1 mb-3 text-sm text-sand-300">{t('profile.feedbackSubtitle')}</p>
        {feedbackSent && <Alert variant="success" message={t('profile.feedbackSent')} />}
        {feedbackError && <Alert variant="error" message={feedbackError} />}
        <form className="mt-3 flex flex-col gap-3" onSubmit={handleSendFeedback}>
          <textarea
            rows={3}
            placeholder={t('profile.feedbackPlaceholder')}
            className="w-full resize-y rounded-xl border border-navy-700 bg-navy-950 px-3 py-2.5 text-sm text-sand-100 outline-none placeholder:text-sand-400 focus:border-turquoise-400"
            value={feedbackMessage}
            onChange={(e) => {
              setFeedbackMessage(e.target.value)
              setFeedbackSent(false)
            }}
          />
          <Button
            type="submit"
            variant="secondary"
            isLoading={isSendingFeedback}
            disabled={!feedbackMessage.trim()}
            className="self-start"
          >
            {t('profile.feedbackSend')}
          </Button>
        </form>
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
