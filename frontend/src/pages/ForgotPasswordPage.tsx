import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { usePageTitle } from '../hooks/usePageTitle'
import { requestPasswordReset } from '../services/accountService'
import { getApiError } from '../utils/apiError'
import './AuthPages.css'

const forgotSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email').pipe(z.email('Enter a valid email address')),
})

type ForgotValues = z.infer<typeof forgotSchema>

export default function ForgotPasswordPage() {
  usePageTitle('Forgot password')
  const [answer, setAnswer] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema) })

  const onSubmit = async ({ email }: ForgotValues) => {
    setFormError(null)
    try {
      setAnswer(await requestPasswordReset(email))
    } catch (error) {
      setFormError(getApiError(error).message)
    }
  }

  if (answer) {
    return (
      <div className="auth-page">
        <div className="card auth-card">
          <h1>Check your email</h1>
          <div className="alert alert-success" role="status">{answer}</div>
          <p className="card-text">The link works once, for 1 hour. If it hasn&apos;t arrived in a few minutes, check your spam folder or try again.</p>
          {import.meta.env.DEV && (
            <p className="card-note">
              While we build the app, emails go to the <Link to="/dev/mailbox" className="text-link">practice mailbox</Link>.
            </p>
          )}
          <p className="auth-switch"><Link to="/login" className="text-link">Back to log in</Link></p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1>Forgot your password?</h1>
        <p className="auth-subtitle">Enter the email for your account and we&apos;ll send you a link to choose a new one.</p>

        {formError && <div className="alert alert-error" role="alert">{formError}</div>}

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
          <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
            {isSubmitting ? 'Sending...' : 'Send the link'}
          </button>
        </form>

        <p className="auth-switch">
          Remembered it? <Link to="/login" className="text-link">Log in</Link>
        </p>
      </div>
    </div>
  )
}
