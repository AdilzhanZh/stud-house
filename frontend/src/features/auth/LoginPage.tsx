import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocation, useNavigate, type Location } from 'react-router-dom'
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
      // "/" (not a hardcoded student path) so RoleBasedRedirect sends
      // admin/manager to their own panel instead of the student home page.
      navigate(from?.pathname ?? '/', { replace: true })
    } catch (error) {
      setServerError(extractErrorMessage(error, 'Кіру сәтсіз аяқталды'))
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <span className="mx-auto flex h-28 w-28 items-center justify-center">
        <img src="/favicon.svg" alt="" className="h-full w-full object-contain" />
      </span>
      <div>
        <p className="text-[26px] leading-tight font-bold text-sand-100">Қош келдің!</p>
        <p className="mt-1.5 text-sm text-sand-300">
          Жатақханаға өтініш беру мен бақылау — бір жерде.
        </p>
      </div>

      <form className="mt-2 flex flex-col gap-3" onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError && <Alert variant="error" message={serverError} />}

        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Құпия сөз"
          type="password"
          autoComplete="current-password"
          required
          error={errors.password?.message}
          {...register('password')}
        />

        <Button type="submit" isLoading={isSubmitting} className="mt-1.5 w-full">
          Кіру
        </Button>

        <p className="mt-1 text-center text-sm text-sand-300">
          Аккаунт жоқ па?{' '}
          <Link to="/register" className="font-semibold text-turquoise-400 hover:text-turquoise-300">
            Тіркелу
          </Link>
        </p>
      </form>
    </div>
  )
}
