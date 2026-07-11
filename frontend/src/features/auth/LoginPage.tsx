import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocation, useNavigate, type Location } from 'react-router-dom'
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
      // admin/manager to their own panel instead of the student-only
      // profile page.
      navigate(from?.pathname ?? '/', { replace: true })
    } catch (error) {
      setServerError(extractErrorMessage(error, 'Кіру сәтсіз аяқталды'))
    }
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="font-heading text-4xl leading-tight text-sand-100">Қош келдіңіз</h1>
      <p className="mt-3 text-sm text-sand-300/70">
        Жатақханаға өтініш беру және оны бақылау жүйесіне кіріңіз.
      </p>

      <form className="mt-8 flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError && (
          <div
            role="alert"
            className="rounded-lg border border-clay-500/30 bg-clay-500/10 px-3.5 py-2.5 text-sm text-clay-400"
          >
            {serverError}
          </div>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-sand-200">
            Email <span className="text-clay-400">*</span>
          </span>
          <input
            type="email"
            autoComplete="email"
            required
            aria-invalid={Boolean(errors.email)}
            className="rounded-lg border border-sand-100/15 bg-navy-900/60 px-3.5 py-2.5 text-sm text-sand-100 outline-none transition-colors placeholder:text-sand-400/50 focus:border-turquoise-400 focus:ring-4 focus:ring-turquoise-400/15"
            {...register('email')}
          />
          {errors.email && <span className="text-xs text-clay-400">{errors.email.message}</span>}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-sand-200">
            Құпия сөз <span className="text-clay-400">*</span>
          </span>
          <input
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={Boolean(errors.password)}
            className="rounded-lg border border-sand-100/15 bg-navy-900/60 px-3.5 py-2.5 text-sm text-sand-100 outline-none transition-colors placeholder:text-sand-400/50 focus:border-turquoise-400 focus:ring-4 focus:ring-turquoise-400/15"
            {...register('password')}
          />
          {errors.password && <span className="text-xs text-clay-400">{errors.password.message}</span>}
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-turquoise-500 px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-turquoise-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-turquoise-400/30 disabled:cursor-not-allowed disabled:bg-turquoise-500/50"
        >
          {isSubmitting && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/40 border-t-ink" />
          )}
          Жүйеге кіру
        </button>

        <p className="text-center text-sm text-sand-300/70">
          Аккаунтыңыз жоқ па?{' '}
          <Link to="/register" className="font-medium text-turquoise-400 hover:text-turquoise-300 hover:underline">
            Тіркелу
          </Link>
        </p>
      </form>
    </div>
  )
}
