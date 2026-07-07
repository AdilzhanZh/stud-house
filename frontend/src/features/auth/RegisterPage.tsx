import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { Card } from '../../components/Card'
import { Input } from '../../components/Input'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import { extractErrorMessage } from '../../api/client'
import { useAuth } from './useAuth'
import { registerSchema, type RegisterFormValues } from './schemas'

export function RegisterPage() {
  const { register: registerStudent, login } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) })

  async function onSubmit(values: RegisterFormValues) {
    setServerError(null)
    try {
      await registerStudent({
        full_name: values.full_name,
        email: values.email,
        phone: values.phone,
        password: values.password,
      })
      // Auto-login right after registering so the student lands straight on
      // their dashboard instead of re-typing credentials on a login page.
      await login(values.email, values.password)
      navigate('/dashboard/profile', { replace: true })
    } catch (error) {
      setServerError(extractErrorMessage(error, 'Тіркелу сәтсіз аяқталды'))
    }
  }

  return (
    <Card title="Тіркелу">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError && <Alert variant="error" message={serverError} />}
        <Input
          label="Аты-жөні"
          autoComplete="name"
          error={errors.full_name?.message}
          {...register('full_name')}
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Телефон"
          type="tel"
          autoComplete="tel"
          error={errors.phone?.message}
          {...register('phone')}
        />
        <Input
          label="Құпия сөз"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Input
          label="Құпия сөзді қайталаңыз"
          type="password"
          autoComplete="new-password"
          error={errors.password_confirm?.message}
          {...register('password_confirm')}
        />
        <Button type="submit" isLoading={isSubmitting}>
          Тіркелу
        </Button>
        <p className="text-center text-sm text-gray-600">
          Аккаунтыңыз бар ма?{' '}
          <Link to="/login" className="font-medium text-indigo-600 hover:underline">
            Кіру
          </Link>
        </p>
      </form>
    </Card>
  )
}
