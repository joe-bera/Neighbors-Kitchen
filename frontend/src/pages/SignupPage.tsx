import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { usePageTitle } from '../hooks/usePageTitle'
import { signup } from '../services/authService'
import { getApiError } from '../utils/apiError'
import './AuthPages.css'

const signupSchema = z.object({
  role: z.enum(['CUSTOMER', 'CHEF']),
  firstName: z.string().trim().min(1, 'Enter your first name').max(50, 'Use 50 characters or less'),
  lastName: z.string().trim().min(1, 'Enter your last name').max(50, 'Use 50 characters or less'),
  email: z.string().trim().min(1, 'Enter your email').pipe(z.email('Enter a valid email address')),
  password: z
    .string()
    .min(8, 'Use at least 8 characters')
    .max(72, 'Use 72 characters or less')
    .regex(/[A-Za-z]/, 'Include at least one letter')
    .regex(/[0-9]/, 'Include at least one number'),
})

type SignupValues = z.infer<typeof signupSchema>
type SignupField = keyof SignupValues

const FIELDS: SignupField[] = ['role', 'firstName', 'lastName', 'email', 'password']

export default function SignupPage() {
  usePageTitle('Create your account')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { role: searchParams.get('role') === 'chef' ? 'CHEF' : 'CUSTOMER' },
  })

  const onSubmit = async (values: SignupValues) => {
    setFormError(null)
    try {
      await signup(values)
      // New chefs go straight to setting up their kitchen.
      navigate(values.role === 'CHEF' ? '/chef/setup' : '/account', { replace: true, state: { justSignedUp: true } })
    } catch (error) {
      const apiError = getApiError(error)
      const fieldErrors = Object.entries(apiError.details ?? {}).filter(([field]) =>
        FIELDS.includes(field as SignupField),
      )
      if (apiError.code === 'EMAIL_TAKEN') {
        setError('email', { message: apiError.message })
      } else if (fieldErrors.length > 0) {
        fieldErrors.forEach(([field, message]) => setError(field as SignupField, { message }))
      } else {
        setFormError(apiError.message)
      }
    }
  }

  const fieldProps = (name: SignupField) => ({
    id: name,
    className: 'field-input',
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
    ...register(name),
  })

  const fieldError = (name: SignupField) =>
    errors[name] && <p id={`${name}-error`} className="field-error">{errors[name]?.message}</p>

  return (
    <div className="auth-page">
      <div className="card auth-card auth-card--wide">
        <h1>Create your account</h1>
        <p className="auth-subtitle">Join your neighbors for home-cooked meals, or share your own cooking.</p>

        {formError && (
          <div className="alert alert-error" role="alert">
            {formError}
          </div>
        )}

        <form className="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <fieldset className="role-picker">
            <legend className="field-label">How will you use Neighbors Kitchen?</legend>
            <div className="role-options">
              <label className="role-option">
                <input type="radio" value="CUSTOMER" className="visually-hidden" {...register('role')} />
                <span className="role-title">I want to order meals</span>
                <span className="role-description">Discover home-cooked food from chefs near you.</span>
              </label>
              <label className="role-option">
                <input type="radio" value="CHEF" className="visually-hidden" {...register('role')} />
                <span className="role-title">I want to cook and sell</span>
                <span className="role-description">Share your cooking and earn money from your kitchen.</span>
              </label>
            </div>
          </fieldset>

          <div className="form-row">
            <div className="field">
              <label className="field-label" htmlFor="firstName">First name</label>
              <input type="text" autoComplete="given-name" {...fieldProps('firstName')} />
              {fieldError('firstName')}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="lastName">Last name</label>
              <input type="text" autoComplete="family-name" {...fieldProps('lastName')} />
              {fieldError('lastName')}
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="email">Email</label>
            <input type="email" autoComplete="email" {...fieldProps('email')} />
            {fieldError('email')}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="password">Password</label>
            <input type="password" autoComplete="new-password" {...fieldProps('password')} />
            {fieldError('password') ?? (
              <p className="field-hint">At least 8 characters, including a letter and a number.</p>
            )}
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
            {isSubmitting ? 'Creating your account...' : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login" className="text-link">Log in</Link>
        </p>
      </div>
    </div>
  )
}
