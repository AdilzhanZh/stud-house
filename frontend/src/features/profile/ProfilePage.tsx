import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card } from '../../components/Card'
import { Select } from '../../components/Select'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import { extractErrorMessage } from '../../api/client'
import { useAuth } from '../auth/useAuth'
import { getStudentProfile, updateStudentProfile } from '../../api/profileApi'
import type { StudentProfile } from '../../types'

// Backend's StudentProfile only has gender + course — no faculty field, so
// (per project decision) that's dropped from this form entirely rather than
// collecting a value the API would silently ignore.
const profileSchema = z.object({
  gender: z.enum(['male', 'female', '']),
  course: z.string(),
})

type ProfileFormValues = z.infer<typeof profileSchema>

export function ProfilePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { gender: '', course: '' },
  })

  useEffect(() => {
    if (!user) return
    getStudentProfile(user.id)
      .then((data) => {
        setProfile(data)
        reset({
          gender: data.gender ?? '',
          course: data.course != null ? String(data.course) : '',
        })
      })
      .catch((error) => setLoadError(extractErrorMessage(error, 'Профильді жүктеу сәтсіз аяқталды')))
  }, [user, reset])

  async function onSubmit(values: ProfileFormValues) {
    if (!user) return
    setServerError(null)
    setSavedMessage(null)
    try {
      const updated = await updateStudentProfile(user.id, {
        gender: values.gender === '' ? null : values.gender,
        course: values.course === '' ? null : Number(values.course),
      })
      setProfile(updated)
      setSavedMessage('Профиль сақталды')
    } catch (error) {
      setServerError(extractErrorMessage(error, 'Сақтау сәтсіз аяқталды'))
    }
  }

  if (!user) return null

  return (
    <div className="flex flex-col gap-6">
      <Card title="Негізгі ақпарат">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">Аты-жөні</dt>
            <dd className="text-sm text-gray-900">{user.full_name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">Email</dt>
            <dd className="text-sm text-gray-900">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">Телефон</dt>
            <dd className="text-sm text-gray-900">{user.phone || '—'}</dd>
          </div>
        </dl>
      </Card>

      <Card title="Студент профилі">
        {loadError && <Alert variant="error" message={loadError} />}
        {!loadError && !profile && <p className="text-sm text-gray-500">Жүктелуде...</p>}
        {profile && (
          <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            {serverError && <Alert variant="error" message={serverError} />}
            {savedMessage && <Alert variant="success" message={savedMessage} />}
            <Select label="Жынысы" {...register('gender')}>
              <option value="">Таңдалмаған</option>
              <option value="male">Ер</option>
              <option value="female">Әйел</option>
            </Select>
            <Select label="Курс" {...register('course')}>
              <option value="">Таңдалмаған</option>
              {[1, 2, 3, 4, 5, 6].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Button type="submit" isLoading={isSubmitting} className="self-start">
              Сақтау
            </Button>
          </form>
        )}
      </Card>
    </div>
  )
}
