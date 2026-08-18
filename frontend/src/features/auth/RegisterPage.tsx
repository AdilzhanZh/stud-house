import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Card } from '../../components/Card'
import { Input } from '../../components/Input'
import { Select } from '../../components/Select'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { extractErrorMessage, getErrorCode } from '../../api/client'
import { useAuth } from './useAuth'
import { buildRegisterSchema, type RegisterFormValues } from './schemas'

type Step = 'form' | 'done'

export function RegisterPage() {
  const { t } = useTranslation()
  const { register: registerStudent } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('form')

  // Set when the backend flags the email as unreachable — offers the
  // applicant a choice between fixing it and registering anyway.
  const [pendingValues, setPendingValues] = useState<RegisterFormValues | null>(null)
  const [isContinuing, setIsContinuing] = useState(false)

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

  function payloadFrom(values: RegisterFormValues, skipEmailCheck: boolean) {
    const fullName = [values.aty, values.familiya, values.tegi]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(' ')
    return {
      full_name: fullName,
      email: values.email,
      phone: values.phone,
      iin: values.iin,
      password: values.password,
      gender: values.gender,
      course: Number(values.course),
      academic_degree: values.academic_degree,
      skip_email_check: skipEmailCheck,
    }
  }

  async function onSubmit(values: RegisterFormValues) {
    setServerError(null)
    try {
      await registerStudent(payloadFrom(values, false))
      setStep('done')
    } catch (error) {
      if (getErrorCode(error) === 'email_unverifiable') {
        setPendingValues(values)
        return
      }
      setServerError(extractErrorMessage(error, t('auth.registerFailed')))
    }
  }

  async function handleContinueAnyway() {
    if (!pendingValues) return
    setIsContinuing(true)
    try {
      await registerStudent(payloadFrom(pendingValues, true))
      setPendingValues(null)
      setStep('done')
    } catch (error) {
      setPendingValues(null)
      setServerError(extractErrorMessage(error, t('auth.registerFailed')))
    } finally {
      setIsContinuing(false)
    }
  }

  if (step === 'done') {
    return (
      <Card title={t('auth.doneTitle')}>
        <Alert variant="success" message={t('auth.doneMessage')} />
        <p className="mt-4 text-center text-sm text-sand-300/70">
          <Link to="/login" className="font-medium text-turquoise-400 hover:underline">
            {t('auth.backToLogin')}
          </Link>
        </p>
      </Card>
    )
  }

  return (
    <Card title={t('auth.registerTitle')}>
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
        <Button type="submit" isLoading={isSubmitting}>
          {t('auth.registerButton')}
        </Button>
        <p className="text-center text-sm text-sand-300/70">
          {t('auth.haveAccount')}{' '}
          <Link to="/login" className="font-medium text-turquoise-400 hover:underline">
            {t('auth.loginLink')}
          </Link>
        </p>
      </form>

      <ConfirmDialog
        open={pendingValues != null}
        title={t('auth.emailCheckTitle')}
        message={t('auth.emailCheckMessage', { email: pendingValues?.email })}
        cancelLabel={t('auth.emailCheckChange')}
        confirmLabel={t('auth.emailCheckContinue')}
        isLoading={isContinuing}
        onCancel={() => setPendingValues(null)}
        onConfirm={handleContinueAnyway}
      />
    </Card>
  )
}
