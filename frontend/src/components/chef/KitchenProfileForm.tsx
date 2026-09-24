import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import type { KitchenProfileInput, OwnKitchen } from '../../types/kitchen.types'
import { getApiError } from '../../utils/apiError'

/** "Mexican, Vegan" becomes ["Mexican", "Vegan"]. */
const splitList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const listField = (label: string, max: number, itemMax: number, required: boolean) =>
  z
    .string()
    .transform(splitList)
    .refine((items) => !required || items.length > 0, `Add at least one ${label}`)
    .refine((items) => items.length <= max, `Add up to ${max} ${label}s`)
    .refine((items) => items.every((item) => item.length >= 2 && item.length <= itemMax), `Each ${label} should be 2 to ${itemMax} characters`)

const kitchenFormSchema = z.object({
  kitchenName: z.string().trim().min(2, 'Give your kitchen a name (at least 2 characters)').max(60, 'Use 60 characters or less'),
  bio: z
    .string()
    .trim()
    .min(20, 'Tell neighbors a little more about your cooking (at least 20 characters)')
    .max(1000, 'Use 1,000 characters or less'),
  specialties: listField('specialty', 5, 30, true),
  certifications: listField('certification', 5, 80, false),
  yearsExperience: z
    .string()
    .trim()
    .transform((value) => (value === '' ? null : Number(value)))
    .pipe(z.number('Use a number, like 5').int('Use a whole number').min(0).max(70, 'Use 70 or less').nullable()),
  addressLine1: z.string().trim().min(3, 'Enter your street address').max(100),
  addressLine2: z.string().trim().max(100).transform((value) => value || null),
  city: z.string().trim().min(2, 'Enter your city').max(60),
  state: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'Use the 2-letter code, like CA'),
  zipCode: z.string().trim().regex(/^\d{5}(-\d{4})?$/, 'Enter a 5-digit ZIP code'),
  serviceRadiusMiles: z.string().transform(Number).pipe(z.number().min(1).max(50)),
})

type KitchenFormInput = z.input<typeof kitchenFormSchema>
type KitchenFormOutput = z.output<typeof kitchenFormSchema>
type KitchenField = keyof KitchenFormInput

const FIELDS = Object.keys(kitchenFormSchema.shape) as KitchenField[]
const FIELDS_WITH_HINTS = new Set<KitchenField>(['bio', 'specialties', 'certifications'])
const RADIUS_OPTIONS = [2, 5, 10, 15, 25]

function toFormValues(kitchen?: OwnKitchen): KitchenFormInput {
  return {
    kitchenName: kitchen?.kitchenName ?? '',
    bio: kitchen?.bio ?? '',
    specialties: kitchen?.specialties.join(', ') ?? '',
    certifications: kitchen?.certifications.join(', ') ?? '',
    yearsExperience: kitchen?.yearsExperience?.toString() ?? '',
    addressLine1: kitchen?.addressLine1 ?? '',
    addressLine2: kitchen?.addressLine2 ?? '',
    city: kitchen?.city ?? '',
    state: kitchen?.state ?? 'CA',
    zipCode: kitchen?.zipCode ?? '',
    serviceRadiusMiles: String(kitchen?.serviceRadiusMiles ?? 5),
  }
}

interface KitchenProfileFormProps {
  initialKitchen?: OwnKitchen
  submitLabel: string
  submittingLabel: string
  onSubmit: (values: KitchenProfileInput) => Promise<void>
}

export default function KitchenProfileForm({ initialKitchen, submitLabel, submittingLabel, onSubmit }: KitchenProfileFormProps) {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<KitchenFormInput, unknown, KitchenFormOutput>({
    resolver: zodResolver(kitchenFormSchema),
    defaultValues: toFormValues(initialKitchen),
  })

  const submit = async (values: KitchenFormOutput) => {
    setFormError(null)
    try {
      await onSubmit(values)
    } catch (error) {
      const apiError = getApiError(error)
      const fieldErrors = Object.entries(apiError.details ?? {}).filter(([field]) => FIELDS.includes(field as KitchenField))
      if (fieldErrors.length > 0) {
        fieldErrors.forEach(([field, message]) => setError(field as KitchenField, { message }))
      } else {
        setFormError(apiError.message)
      }
    }
  }

  const fieldProps = (name: KitchenField) => ({
    id: name,
    className: 'field-input',
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `${name}-error` : FIELDS_WITH_HINTS.has(name) ? `${name}-hint` : undefined,
    ...register(name),
  })
  const fieldError = (name: KitchenField) =>
    errors[name] && <p id={`${name}-error`} className="field-error">{errors[name]?.message}</p>

  return (
    <form className="form" onSubmit={handleSubmit(submit)} noValidate>
      {formError && <div className="alert alert-error" role="alert">{formError}</div>}

      <fieldset className="form-section">
        <legend>About your kitchen</legend>
        <div className="field">
          <label className="field-label" htmlFor="kitchenName">Kitchen name</label>
          <input type="text" placeholder="e.g. Abuela's Table" {...fieldProps('kitchenName')} />
          {fieldError('kitchenName')}
        </div>
        <div className="field">
          <label className="field-label" htmlFor="bio">About you and your cooking</label>
          <textarea rows={4} placeholder="Where your recipes come from, what you love to cook..." {...fieldProps('bio')} />
          {fieldError('bio') ?? <p id="bio-hint" className="field-hint">Customers see this on your profile.</p>}
        </div>
        <div className="field">
          <label className="field-label" htmlFor="specialties">Specialties</label>
          <input type="text" placeholder="Mexican, Comfort Food" {...fieldProps('specialties')} />
          {fieldError('specialties') ?? <p id="specialties-hint" className="field-hint">Separate with commas. Up to 5.</p>}
        </div>
        <div className="form-row">
          <div className="field">
            <label className="field-label" htmlFor="yearsExperience">Years of cooking (optional)</label>
            <input type="number" inputMode="numeric" min={0} max={70} {...fieldProps('yearsExperience')} />
            {fieldError('yearsExperience')}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="certifications">Certifications (optional)</label>
            <input type="text" placeholder="California Food Handler Card" {...fieldProps('certifications')} />
            {fieldError('certifications') ?? <p id="certifications-hint" className="field-hint">Separate with commas.</p>}
          </div>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Where you cook</legend>
        <p className="form-section-note">
          Your street address stays private. Customers only see your city, and pickup details are shared after an order is confirmed.
        </p>
        <div className="field">
          <label className="field-label" htmlFor="addressLine1">Street address</label>
          <input type="text" autoComplete="address-line1" {...fieldProps('addressLine1')} />
          {fieldError('addressLine1')}
        </div>
        <div className="field">
          <label className="field-label" htmlFor="addressLine2">Apartment, suite, etc. (optional)</label>
          <input type="text" autoComplete="address-line2" {...fieldProps('addressLine2')} />
          {fieldError('addressLine2')}
        </div>
        <div className="form-row form-row--address">
          <div className="field">
            <label className="field-label" htmlFor="city">City</label>
            <input type="text" autoComplete="address-level2" {...fieldProps('city')} />
            {fieldError('city')}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="state">State</label>
            <input type="text" autoComplete="address-level1" maxLength={2} {...fieldProps('state')} />
            {fieldError('state')}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="zipCode">ZIP code</label>
            <input type="text" inputMode="numeric" autoComplete="postal-code" {...fieldProps('zipCode')} />
            {fieldError('zipCode')}
          </div>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="serviceRadiusMiles">How far will you serve?</label>
          <select {...fieldProps('serviceRadiusMiles')}>
            {RADIUS_OPTIONS.map((miles) => (
              <option key={miles} value={miles}>Within {miles} miles</option>
            ))}
          </select>
          {fieldError('serviceRadiusMiles')}
        </div>
      </fieldset>

      <button type="submit" className="btn btn-primary btn-large" disabled={isSubmitting}>
        {isSubmitting ? submittingLabel : submitLabel}
      </button>
    </form>
  )
}
