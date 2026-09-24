import { useState, type FormEvent } from 'react'
import { updateSuggestion } from '../../services/feedbackService'
import type { Suggestion, SuggestionStatus } from '../../types/feedback.types'
import { getApiError } from '../../utils/apiError'
import { formatReviewDate, votesLabel } from '../../utils/feedback'
import DietaryTags from '../meal/DietaryTags'

// How the chef answers a request. Neighbors see these as "Waiting for the chef", "Coming soon" and so on.
const ANSWERS: { value: SuggestionStatus; label: string }[] = [
  { value: 'PENDING', label: 'Not answered yet' },
  { value: 'CONSIDERING', label: 'Thinking about it' },
  { value: 'ACCEPTED', label: "Yes, I'll make it" },
  { value: 'DECLINED', label: 'Not for my kitchen' },
]

/** A dish request in the chef dashboard, with the chef's answer and an optional message to neighbors. */
export default function RequestCard({ suggestion: loaded }: { suggestion: Suggestion }) {
  const [saved, setSaved] = useState<Suggestion | null>(null)
  const suggestion = saved ?? loaded
  const [status, setStatus] = useState<SuggestionStatus>(loaded.status)
  const [message, setMessage] = useState(loaded.chefResponse ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const changed = status !== suggestion.status || message.trim() !== (suggestion.chefResponse ?? '')

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const updated = await updateSuggestion(suggestion.id, { status, chefResponse: message.trim() || null })
      setSaved(updated)
      setMessage(updated.chefResponse ?? '')
    } catch (saveError) {
      const apiError = getApiError(saveError)
      setError(Object.values(apiError.details ?? {})[0] ?? apiError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="card dish-request dish-request--dashboard">
      <div className="dish-request-main">
        <h3 className="dish-request-name">{suggestion.mealName}</h3>
        <p className="dish-request-votes">{votesLabel(suggestion.votes)}</p>
        <p className="dish-request-description">{suggestion.description}</p>
        <DietaryTags tags={suggestion.dietaryRequirements} />
        <p className="dish-request-meta">
          Requested by {suggestion.suggestedBy} on {formatReviewDate(suggestion.createdAt)}
        </p>
      </div>

      <form className="request-answer" onSubmit={save} noValidate>
        <div className="field">
          <label className="field-label" htmlFor={`answer-${suggestion.id}`}>Your answer</label>
          <select
            id={`answer-${suggestion.id}`}
            className="field-input"
            value={status}
            onChange={(event) => setStatus(event.target.value as SuggestionStatus)}
          >
            {ANSWERS.map((answer) => (
              <option key={answer.value} value={answer.value}>{answer.label}</option>
            ))}
          </select>
          {status === 'DECLINED' && <p className="field-hint">Declined requests are hidden from your public page.</p>}
        </div>
        <div className="field">
          <label className="field-label" htmlFor={`message-${suggestion.id}`}>
            Message to neighbors <span className="field-optional">(optional, shown on your page)</span>
          </label>
          <textarea
            id={`message-${suggestion.id}`}
            className="field-input"
            rows={2}
            maxLength={500}
            placeholder="e.g. Great idea! It will be on the menu next Saturday."
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary btn-small" disabled={saving || !changed}>
            {saving ? 'Saving...' : 'Save answer'}
          </button>
          {saved && !changed && <span className="save-status" role="status">Saved</span>}
        </div>
      </form>
    </li>
  )
}
