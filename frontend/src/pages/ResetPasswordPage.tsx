import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { usePageTitle } from '../hooks/usePageTitle'
import { resetPassword } from '../services/accountService'
import { useAuthStore } from '../store/authStore'
import { getApiError } from '../utils/apiError'
import './AuthPages.css'

const resetSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .max(72, 'Use 72 characters or less')
      .regex(/[A-Za-z]/, 'Include at least one letter')
      .regex(/[0-9]/, 'Include at least one number'),
    confirmPassword: z.string().min(1, 'Type the new password again'),
  })
  .refine((values) => values.password === values.confirmPassword, { path: ['confirmPassword'], message: 'The passwords do not match' })

type ResetValues = z.infer<typeof resetSchema>

const INCOMPLETE_LINK = 'This link is not complete. Open it from the email again, or ask for a new one.'

export default function ResetPasswordPage() {
  usePageTitle('Choose a new password')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [linkProblem, setLinkProblem] = useState<string | null>(token ? null : INCOMPLETE_LINK)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({ resolver: zodResolver(resetSchema) })

  const onSubmit = async ({ password }: ResetValues) => {
    setFormError(null)
    try {
      await resetPassword(token, password)
      // The server logged out every session; forget this one too.
      useAuthStore.getState().clearSession()
      navigate('/login', { replace: true, state: { message: 'Your password was changed. Log in with your new password.' } })
    } catch (error) {
      const apiError = getApiError(error)
      if (apiError.code === 'INVALID_RESET_LINK') setLinkProblem(apiError.message)
      else setFormError(apiError.message)
    }
  }

  if (linkProblem) {
    return (
      <div className="auth-page">
        <div className="card auth-card">
          <h1>Choose a new password</h1>
          <div className="alert alert-error" role="alert">{linkProblem}</div>
          <Link to="/forgot-password" className="btn btn-primary btn-block">Ask for a new link</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1>Choose a new password</h1>
        <p className="auth-subtitle">Saving it logs you out on every device.</p>

        {formError && <div className="alert alert-error" role="alert">{formError}</div>}

        <form className="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="field">
            <label className="field-label" htmlFor="password">New password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              className="field-input"
              aria-invalid={errors.password ? true : undefined}
              aria-describedby="password-help"
              {...register('password')}
            />
            <p id="password-help" className={errors.password ? 'field-error' : 'field-hint'}>
              {errors.password?.message ?? 'At least 8 characters, including a letter and a number.'}
            </p>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="confirmPassword">New password again</label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              className="field-input"
              aria-invalid={errors.confirmPassword ? true : undefined}
              aria-describedby={errors.confirmPassword ? 'confirm-error' : undefined}
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && <p id="confirm-error" className="field-error">{errors.confirmPassword.message}</p>}
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save new password'}
          </button>
        </form>
      </div>
    </div>
  )
}
