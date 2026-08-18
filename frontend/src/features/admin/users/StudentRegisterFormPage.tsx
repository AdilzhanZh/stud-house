import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card } from '../../../components/Card'
import { Input } from '../../../components/Input'
import { Select } from '../../../components/Select'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import { createStudent } from '../../../api/adminUserApi'
import { buildRegisterSchema, type RegisterFormValues } from '../../auth/schemas'

// Same fields/validation as public self-registration (see RegisterPage), but
// submits to POST /admin/students: the account is created already
// approved and email-verified, with no confirmation step to wait on.
export function StudentRegisterFormPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(buildRegisterSchema(t)) })

  const academicDegree = watch('academic_degree')
  const courseOptions =
    academicDegree === 'master' ? [1, 2] : academicDegree === 'doctorate' ? [1, 2, 3] : [1, 2, 3, 4]

  async function onSubmit(values: RegisterFormValues) {
    setServerError(null)
    try {
      const fullName = [values.aty, values.familiya, values.tegi]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(' ')
      await createStudent({
        full_name: fullName,
        email: values.email,
        phone: values.phone,
        iin: values.iin,
        password: values.password,
        gender: values.gender,
        course: Number(values.course),
        academic_degree: values.academic_degree,
      })
      navigate('/admin/students/pending')
    } catch (error) {
      setServerError(extractErrorMessage(error, t('admin.users.registerStudentFailed')))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Button variant="secondary" className="self-start" onClick={() => navigate('/admin/students/pending')}>
        ← {t('admin.common.back')}
      </Button>

      <Card title={t('admin.users.registerStudent')}>
        <p className="mb-4 text-sm text-sand-300/70">{t('admin.users.registerStudentHint')}</p>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          {serverError && <Alert variant="error" message={serverError} />}
          <Input
            label={t('auth.firstName')}
            autoComplete="given-name"
            error={errors.aty?.message}
            required
            {...register('aty')}
          />
          <Input
            label={t('auth.lastName')}
            autoComplete="family-name"
            error={errors.familiya?.message}
            required
            {...register('familiya')}
          />
          <Input
            label={t('auth.patronymic')}
            error={errors.tegi?.message}
            required
            {...register('tegi')}
          />
          <Input
            label={t('auth.email')}
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            required
            {...register('email')}
          />
          <Input
            label={t('auth.phone')}
            type="tel"
            autoComplete="tel"
            error={errors.phone?.message}
            required
            {...register('phone')}
          />
          <Input
            label={t('auth.iin')}
            inputMode="numeric"
            maxLength={12}
            placeholder={t('auth.iinPlaceholder')}
            error={errors.iin?.message}
            required
            {...register('iin')}
          />
          <Select label={t('auth.gender')} error={errors.gender?.message} required {...register('gender')}>
            <option value="">{t('auth.selectPlaceholder')}</option>
            <option value="male">{t('auth.male')}</option>
            <option value="female">{t('auth.female')}</option>
          </Select>
          <Select
            label={t('auth.academicDegree')}
            error={errors.academic_degree?.message}
            required
            {...register('academic_degree', {
              onChange: () => resetField('course'),
            })}
          >
            <option value="">{t('auth.selectPlaceholder')}</option>
            <option value="bachelor">{t('auth.bachelor')}</option>
            <option value="master">{t('auth.master')}</option>
            <option value="doctorate">{t('auth.doctorate')}</option>
          </Select>
          <Select label={t('auth.course')} error={errors.course?.message} required {...register('course')}>
            <option value="">{t('auth.selectPlaceholder')}</option>
            {courseOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Input
            label={t('auth.password')}
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            required
            {...register('password')}
          />
          <Input
            label={t('auth.passwordConfirm')}
            type="password"
            autoComplete="new-password"
            error={errors.password_confirm?.message}
            required
            {...register('password_confirm')}
          />
          <Button type="submit" isLoading={isSubmitting} className="self-start">
            {t('admin.users.registerStudent')}
          </Button>
        </form>
      </Card>
    </div>
  )
}
