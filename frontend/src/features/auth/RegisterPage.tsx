import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { Card } from '../../components/Card'
import { Input } from '../../components/Input'
import { Select } from '../../components/Select'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import { extractErrorMessage } from '../../api/client'
import { resendVerification, verifyEmail } from '../../api/authApi'
import { useAuth } from './useAuth'
import { registerSchema, type RegisterFormValues } from './schemas'

type Step = 'form' | 'verify' | 'done'

export function RegisterPage() {
  const { register: registerStudent } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('form')
  const [email, setEmail] = useState('')

  const [code, setCode] = useState('')
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [isResending, setIsResending] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) })

  const academicDegree = watch('academic_degree')
  const courseOptions = academicDegree === 'master' ? [1, 2] : [1, 2, 3, 4]

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
      setServerError(extractErrorMessage(error, 'Тіркелу сәтсіз аяқталды'))
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
      setVerifyError(extractErrorMessage(error, 'Код қате немесе мерзімі өткен'))
    } finally {
      setIsVerifying(false)
    }
  }

  async function handleResend() {
    setVerifyError(null)
    setResendMessage(null)
    setIsResending(true)
    try {
      await resendVerification(email)
      setResendMessage('Код қайта жіберілді')
    } catch (error) {
      setVerifyError(extractErrorMessage(error, 'Кодты қайта жіберу сәтсіз аяқталды'))
    } finally {
      setIsResending(false)
    }
  }

  if (step === 'done') {
    return (
      <Card title="Тіркелу сәтті өтті">
        <Alert
          variant="success"
          message="Email расталды. Тіркелу өтінішіңіз менеджердің қарауында, растағаннан кейін жүйеге кіре аласыз."
        />
        <p className="mt-4 text-center text-sm text-sand-300/70">
          <Link to="/login" className="font-medium text-turquoise-400 hover:underline">
            Кіру бетіне оралу
          </Link>
        </p>
      </Card>
    )
  }

  if (step === 'verify') {
    return (
      <Card title="Email-ды растау">
        <p className="mb-4 text-sm text-sand-300/70">
          {email} мекенжайына жіберілген 6 таңбалы кодты енгізіңіз.
        </p>
        <form className="flex flex-col gap-4" onSubmit={handleVerify} noValidate>
          {verifyError && <Alert variant="error" message={verifyError} />}
          {resendMessage && <Alert variant="success" message={resendMessage} />}
          <Input
            label="Растау коды"
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <Button type="submit" isLoading={isVerifying}>
            Растау
          </Button>
          <Button type="button" variant="secondary" isLoading={isResending} onClick={handleResend}>
            Кодты қайта жіберу
          </Button>
        </form>
      </Card>
    )
  }

  return (
    <Card title="Тіркелу">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError && <Alert variant="error" message={serverError} />}
        <Input
          label="Аты"
          autoComplete="given-name"
          error={errors.aty?.message}
          required
          {...register('aty')}
        />
        <Input label="Фамилия" autoComplete="family-name" {...register('familiya')} />
        <Input label="Тегі" {...register('tegi')} />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          required
          {...register('email')}
        />
        <Input
          label="Телефон"
          type="tel"
          autoComplete="tel"
          error={errors.phone?.message}
          required
          {...register('phone')}
        />
        <Input
          label="ЖСН (ИИН)"
          inputMode="numeric"
          maxLength={12}
          placeholder="12 таңбалы сан"
          error={errors.iin?.message}
          required
          {...register('iin')}
        />
        <Select label="Жынысы" error={errors.gender?.message} required {...register('gender')}>
          <option value="">Таңдаңыз</option>
          <option value="male">Ер</option>
          <option value="female">Әйел</option>
        </Select>
        <Select
          label="Оқу деңгейі"
          error={errors.academic_degree?.message}
          required
          {...register('academic_degree', {
            onChange: () => resetField('course'),
          })}
        >
          <option value="">Таңдаңыз</option>
          <option value="bachelor">Бакалавриат</option>
          <option value="master">Магистратура</option>
        </Select>
        <Select label="Курс" error={errors.course?.message} required {...register('course')}>
          <option value="">Таңдаңыз</option>
          {courseOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Input
          label="Құпия сөз"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          required
          {...register('password')}
        />
        <Input
          label="Құпия сөзді қайталаңыз"
          type="password"
          autoComplete="new-password"
          error={errors.password_confirm?.message}
          required
          {...register('password_confirm')}
        />
        <Button type="submit" isLoading={isSubmitting}>
          Тіркелу
        </Button>
        <p className="text-center text-sm text-sand-300/70">
          Аккаунтыңыз бар ма?{' '}
          <Link to="/login" className="font-medium text-turquoise-400 hover:underline">
            Кіру
          </Link>
        </p>
      </form>
    </Card>
  )
}
