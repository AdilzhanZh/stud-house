import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocation, useNavigate, type Location } from 'react-router-dom'
import { Card } from '../../components/Card'
import { Input } from '../../components/Input'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import { extractErrorMessage } from '../../api/client'
import { useAuth } from './useAuth'
import { loginSchema, type LoginFormValues } from './schemas'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(values: LoginFormValues) {
    setServerError(null)
    try {
      await login(values.email, values.password)
      const from = (location.state as { from?: Location } | null)?.from
      navigate(from?.pathname ?? '/dashboard/profile', { replace: true })
    } catch (error) {
      setServerError(extractErrorMessage(error, 'Кіру сәтсіз аяқталды'))
    }
  }

  return (
    <Card title="Кіру">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError && <Alert variant="error" message={serverError} />}
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Құпия сөз"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" isLoading={isSubmitting}>
          Кіру
        </Button>
        <p className="text-center text-sm text-gray-600">
          Аккаунтыңыз жоқ па?{' '}
          <Link to="/register" className="font-medium text-indigo-600 hover:underline">
            Тіркелу
          </Link>
        </p>
      </form>
    </Card>
  )
}
