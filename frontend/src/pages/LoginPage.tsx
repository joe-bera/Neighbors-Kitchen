import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { usePageTitle } from '../hooks/usePageTitle'
import { login } from '../services/authService'
import { getApiError } from '../utils/apiError'
import { getSafeRedirect } from '../utils/safeRedirect'
import './AuthPages.css'

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email'),
  password: z.string().min(1, 'Enter your password'),
})

type LoginValues = z.infer<typeof loginSchema>

const DEMO_PASSWORD = 'Password123'

export default function LoginPage() {
  usePageTitle('Log in')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (values: LoginValues) => {
    setFormError(null)
    try {
      await login(values)
      navigate(getSafeRedirect(searchParams.get('redirect'), '/account'), { replace: true })
    } catch (error) {
      setFormError(getApiError(error).message)
    }
  }

  const fillDemoAccount = (email: string) => {
    setValue('email', email, { shouldValidate: true })
    setValue('password', DEMO_PASSWORD, { shouldValidate: true })
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1>Welcome back</h1>
        <p className="auth-subtitle">Log in to order meals or manage your kitchen.</p>

        {formError && (
          <div className="alert alert-error" role="alert">
            {formError}
          </div>
        )}

        <form className="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="field">
            <label className="field-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="field-input"
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? 'email-error' : undefined}
              {...register('email')}
            />
            {errors.email && <p id="email-error" className="field-error">{errors.email.message}</p>}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="field-input"
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? 'password-error' : undefined}
              {...register('password')}
            />
            {errors.password && <p id="password-error" className="field-error">{errors.password.message}</p>}
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
            {isSubmitting ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        <p className="auth-switch">
          New to Neighbors Kitchen? <Link to="/signup" className="text-link">Create an account</Link>
        </p>

        {import.meta.env.DEV && (
          <div className="demo-accounts">
            <p>
              <strong>Try a demo account</strong> (password: {DEMO_PASSWORD})
            </p>
            <div className="demo-buttons">
              <button
                type="button"
                className="btn btn-outline btn-small"
                onClick={() => fillDemoAccount('customer@neighborskitchen.test')}
              >
                Customer demo
              </button>
              <button
                type="button"
                className="btn btn-outline btn-small"
                onClick={() => fillDemoAccount('maria@neighborskitchen.test')}
              >
                Chef demo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
