import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Card } from '../../components/Card'
import { Input } from '../../components/Input'
import { Select } from '../../components/Select'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import { extractErrorMessage } from '../../api/client'
import { resendVerification, verifyEmail } from '../../api/authApi'
import { useAuth } from './useAuth'
import { buildRegisterSchema, type RegisterFormValues } from './schemas'

type Step = 'form' | 'verify' | 'done'

const RESEND_COOLDOWN_SECONDS = 120

export function RegisterPage() {
  const { t } = useTranslation()
  const { register: registerStudent } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('form')
  const [email, setEmail] = useState('')

  const [code, setCode] = useState('')
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [isResending, setIsResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  // A code is sent as soon as the verify step is shown (by registerStudent)
  // and again on every successful resend, so the button starts cooling down
  // both times.
  useEffect(() => {
    if (step !== 'verify') return
    setResendCooldown(RESEND_COOLDOWN_SECONDS)
  }, [step])

  useEffect(() => {
    if (step !== 'verify') return
    const timer = setInterval(() => {
      setResendCooldown((s) => Math.max(0, s - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [step])

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
      await registerStudent({
        full_name: fullName,
        email: values.email,
        phone: values.phone,
        iin: values.iin,
        password: values.password,
        gender: values.gender,
        course: Number(values.course),
        academic_degree: values.academic_degree,
      })
      // Email must be verified with the code just sent before the account
      // even reaches the manager-approval stage.
      setEmail(values.email)
      setStep('verify')
    } catch (error) {
      setServerError(extractErrorMessage(error, t('auth.registerFailed')))
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setVerifyError(null)
    setIsVerifying(true)
    try {
      await verifyEmail(email, code)
      // No auto-login: a newly registered student must wait for a
      // manager/admin to approve the account (backend blocks login until
      // approval_status=approved) before they can access the dashboard.
      setStep('done')
    } catch (error) {
      setVerifyError(extractErrorMessage(error, t('auth.verifyFailed')))
    } finally {
      setIsVerifying(false)
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return
    setVerifyError(null)
    setResendMessage(null)
    setIsResending(true)
    try {
      await resendVerification(email)
      setResendMessage(t('auth.resendSuccess'))
      setResendCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (error) {
      setVerifyError(extractErrorMessage(error, t('auth.resendFailed')))
    } finally {
      setIsResending(false)
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

  if (step === 'verify') {
    return (
      <Card title={t('auth.verifyTitle')}>
        <p className="mb-4 text-sm text-sand-300/70">{t('auth.verifyPrompt', { email })}</p>
        <form className="flex flex-col gap-4" onSubmit={handleVerify} noValidate>
          {verifyError && <Alert variant="error" message={verifyError} />}
          {resendMessage && <Alert variant="success" message={resendMessage} />}
          <Input
            label={t('auth.verifyCodeLabel')}
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <Button type="submit" isLoading={isVerifying}>
            {t('auth.verifyButton')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            isLoading={isResending}
            disabled={resendCooldown > 0}
            onClick={handleResend}
          >
            {resendCooldown > 0
              ? t('auth.resendButtonCooldown', { seconds: resendCooldown })
              : t('auth.resendButton')}
          </Button>
        </form>
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
        <Input label={t('auth.lastName')} autoComplete="family-name" {...register('familiya')} />
        <Input label={t('auth.patronymic')} {...register('tegi')} />
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
    </Card>
  )
}
