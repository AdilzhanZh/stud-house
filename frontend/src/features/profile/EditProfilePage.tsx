import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, Camera } from 'lucide-react'
import { Card } from '../../components/Card'
import { Avatar } from '../../components/Avatar'
import { Input } from '../../components/Input'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import { useAuth } from '../auth/useAuth'
import { uploadFile } from '../../api/uploadApi'
import { updateAvatar, changeOwnPassword, changeOwnEmail } from '../../api/userApi'
import { getStudentProfile, updateStudentDetails, type StudentDetailsUpdate } from '../../api/profileApi'
import { extractErrorMessage } from '../../api/client'

export function EditProfilePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, updateUser } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  const [newEmail, setNewEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailSuccess, setEmailSuccess] = useState(false)
  const [isChangingEmail, setIsChangingEmail] = useState(false)

  const [details, setDetails] = useState<Required<StudentDetailsUpdate>>({
    phone: user?.phone ?? '',
    institute: '',
    study_group: '',
    hometown: '',
    parent_contact: '',
  })
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [detailsSaved, setDetailsSaved] = useState(false)
  const [isSavingDetails, setIsSavingDetails] = useState(false)

  const userId = user?.id
  const isStudent = user?.role === 'student'
  useEffect(() => {
    if (!userId || !isStudent) return
    getStudentProfile(userId)
      .then((profile) =>
        setDetails((d) => ({
          ...d,
          institute: profile.institute,
          study_group: profile.study_group,
          hometown: profile.hometown,
          parent_contact: profile.parent_contact,
        })),
      )
      .catch(() => undefined)
  }, [userId, isStudent])

  if (!user) return null

  function setDetail(field: keyof StudentDetailsUpdate, value: string) {
    setDetails((d) => ({ ...d, [field]: value }))
    setDetailsSaved(false)
  }

  async function handleSaveDetails(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setDetailsError(null)
    setDetailsSaved(false)
    setIsSavingDetails(true)
    try {
      const { user: updated } = await updateStudentDetails(user.id, details)
      updateUser(updated)
      setDetailsSaved(true)
    } catch (err) {
      setDetailsError(extractErrorMessage(err, t('profile.editProfile.detailsSaveFailed')))
    } finally {
      setIsSavingDetails(false)
    }
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

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(false)
    if (newPassword.length < 8) {
      setPasswordError(t('profile.editProfile.passwordMin'))
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('profile.editProfile.passwordMismatch'))
      return
    }
    setIsChangingPassword(true)
    try {
      await changeOwnPassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess(true)
    } catch (err) {
      setPasswordError(extractErrorMessage(err, t('profile.editProfile.changeFailed')))
    } finally {
      setIsChangingPassword(false)
    }
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault()
    setEmailError(null)
    setEmailSuccess(false)
    setIsChangingEmail(true)
    try {
      const updated = await changeOwnEmail(newEmail)
      updateUser(updated)
      setNewEmail('')
      setEmailSuccess(true)
    } catch (err) {
      setEmailError(extractErrorMessage(err, t('profile.editProfile.emailChangeFailed')))
    } finally {
      setIsChangingEmail(false)
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/dashboard/profile')}
          aria-label={t('appDetail.backToList')}
          className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-navy-700 bg-navy-900 text-sand-200"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-[19px] font-bold text-sand-100">{t('profile.editData')}</span>
      </div>

      <Card>
        <p className="mb-3 text-[15px] font-bold text-sand-100">{t('profile.editProfile.avatarTitle')}</p>
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
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          <p className="text-sm text-sand-300">{t('profile.editProfile.avatarHint')}</p>
        </div>
        {avatarError && <Alert variant="error" message={avatarError} />}
      </Card>

      {isStudent && (
        <Card>
          <p className="text-[15px] font-bold text-sand-100">{t('profile.editProfile.detailsTitle')}</p>
          <p className="mt-1 mb-3 text-sm text-sand-300">{t('profile.editProfile.detailsHint')}</p>
          <form className="flex flex-col gap-3" onSubmit={handleSaveDetails}>
            {detailsError && <Alert variant="error" message={detailsError} />}
            <Input
              id="phone"
              label={t('profile.phone')}
              placeholder={t('profile.editProfile.phonePlaceholder')}
              type="tel"
              autoComplete="tel"
              value={details.phone}
              onChange={(e) => setDetail('phone', e.target.value)}
              maxLength={32}
              required
            />
            <Input
              id="institute"
              label={t('referral.instituteLabel')}
              placeholder={t('referral.institutePlaceholder')}
              value={details.institute}
              onChange={(e) => setDetail('institute', e.target.value)}
              maxLength={200}
            />
            <Input
              id="study-group"
              label={t('wizard.studyGroupLabel')}
              placeholder={t('wizard.studyGroupPlaceholder')}
              value={details.study_group}
              onChange={(e) => setDetail('study_group', e.target.value)}
              maxLength={50}
            />
            <Input
              id="hometown"
              label={t('wizard.hometownLabel')}
              placeholder={t('wizard.hometownPlaceholder')}
              value={details.hometown}
              onChange={(e) => setDetail('hometown', e.target.value)}
              maxLength={255}
            />
            <Input
              id="parent-contact"
              label={t('wizard.parentContactLabel')}
              placeholder={t('wizard.parentContactPlaceholder')}
              type="tel"
              value={details.parent_contact}
              onChange={(e) => setDetail('parent_contact', e.target.value)}
              maxLength={30}
            />
            {detailsSaved && <Alert variant="success" message={t('profile.editProfile.detailsSaved')} />}
            <Button type="submit" isLoading={isSavingDetails} className="self-start">
              {t('profile.editProfile.saveDetails')}
            </Button>
          </form>
        </Card>
      )}

      <Card>
        <p className="mb-3 text-[15px] font-bold text-sand-100">{t('profile.editProfile.emailTitle')}</p>
        <form className="flex flex-col gap-3" onSubmit={handleChangeEmail}>
          {emailError && <Alert variant="error" message={emailError} />}
          {emailSuccess && <Alert variant="success" message={t('profile.editProfile.emailChanged')} />}
          <Input
            id="new-email"
            label={t('profile.editProfile.newEmail')}
            type="email"
            autoComplete="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
          />
          <Button type="submit" isLoading={isChangingEmail} className="self-start">
            {t('profile.editProfile.changeEmailButton')}
          </Button>
        </form>
      </Card>

      <Card>
        <p className="mb-3 text-[15px] font-bold text-sand-100">{t('profile.editProfile.passwordTitle')}</p>
        <form className="flex flex-col gap-3" onSubmit={handleChangePassword}>
          {passwordError && <Alert variant="error" message={passwordError} />}
          {passwordSuccess && <Alert variant="success" message={t('profile.editProfile.passwordChanged')} />}
          <Input
            id="current-password"
            label={t('profile.editProfile.currentPassword')}
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <Input
            id="new-password"
            label={t('profile.editProfile.newPassword')}
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <Input
            id="confirm-new-password"
            label={t('profile.editProfile.confirmPassword')}
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <Button type="submit" isLoading={isChangingPassword} className="self-start">
            {t('profile.editProfile.changeButton')}
          </Button>
        </form>
      </Card>
    </div>
  )
}
