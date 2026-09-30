import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { createSuggestion } from '../../services/feedbackService'
import type { Suggestion } from '../../types/feedback.types'
import { getApiError } from '../../utils/apiError'
import { DIETARY_TAGS, formatDietaryTag } from '../../utils/format'

// Same limits as the server, so most mistakes are caught before sending.
const suggestionFormSchema = z.object({
  mealName: z.string().trim().min(2, 'Name the dish you would like').max(80, 'Use 80 characters or less'),
  description: z
    .string()
    .trim()
    .min(10, 'Tell the chef a little more (at least 10 characters)')
    .max(500, 'Use 500 characters or less'),
  dietaryRequirements: z.array(z.string()),
})

type SuggestionFormInput = z.input<typeof suggestionFormSchema>
type SuggestionFormOutput = z.output<typeof suggestionFormSchema>
type SuggestionField = keyof SuggestionFormInput
const FIELDS = Object.keys(suggestionFormSchema.shape) as SuggestionField[]

interface SuggestionFormProps {
  chefId: string
  onSent: (suggestion: Suggestion) => void
  onCancel: () => void
}

/** Asks a chef to cook a dish that is not on their menu. */
export default function SuggestionForm({ chefId, onSent, onCancel }: SuggestionFormProps) {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SuggestionFormInput, unknown, SuggestionFormOutput>({
    resolver: zodResolver(suggestionFormSchema),
    defaultValues: { mealName: '', description: '', dietaryRequirements: [] },
  })

  const submit = async (values: SuggestionFormOutput) => {
    setFormError(null)
    try {
      onSent(await createSuggestion(chefId, values))
    } catch (sendError) {
      const apiError = getApiError(sendError)
      const known = Object.entries(apiError.details ?? {})
        .map(([field, message]) => [field.split('.')[0], message] as const)
        .filter(([field]) => FIELDS.includes(field as SuggestionField))
      if (known.length > 0) {
        known.forEach(([field, message]) => setError(field as SuggestionField, { message }))
      } else {
        setFormError(apiError.message)
      }
    }
  }

  const fieldError = (name: SuggestionField) =>
    errors[name] && <p id={`suggestion-${name}-error`} className="field-error">{errors[name]?.message}</p>
  const describedBy = (name: SuggestionField) => (errors[name] ? `suggestion-${name}-error` : undefined)

  return (
    <form className="card form suggestion-form" onSubmit={handleSubmit(submit)} noValidate>
      {formError && <div className="alert alert-error" role="alert">{formError}</div>}
      <div className="field">
        <label className="field-label" htmlFor="suggestion-mealName">Dish name</label>
        <input
          id="suggestion-mealName"
          type="text"
          className="field-input"
          placeholder="e.g. Birria tacos"
          aria-invalid={errors.mealName ? true : undefined}
          aria-describedby={describedBy('mealName')}
          {...register('mealName')}
        />
        {fieldError('mealName')}
      </div>
      <div className="field">
        <label className="field-label" htmlFor="suggestion-description">Tell the chef about it</label>
        <textarea
          id="suggestion-description"
          className="field-input"
          rows={3}
          placeholder="What is it, and what would make it perfect for you?"
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={describedBy('description')}
          {...register('description')}
        />
        {fieldError('description')}
      </div>
      <fieldset className="checkbox-group">
        <legend className="field-label">
          Dietary needs <span className="field-optional">(optional)</span>
        </legend>
        <div className="checkbox-grid">
          {DIETARY_TAGS.map((tag) => (
            <label key={tag} className="checkbox-option">
              <input type="checkbox" value={tag} {...register('dietaryRequirements')} />
              {formatDietaryTag(tag)}
            </label>
          ))}
        </div>
        {fieldError('dietaryRequirements')}
      </fieldset>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Sending...' : 'Send request'}
        </button>
        <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
