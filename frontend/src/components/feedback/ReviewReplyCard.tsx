import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { respondToReview } from '../../services/feedbackService'
import type { Review } from '../../types/feedback.types'
import { getApiError } from '../../utils/apiError'
import { formatReviewDate } from '../../utils/feedback'
import ChefReply from './ChefReply'
import Stars from './Stars'

/** A review in the chef dashboard, with a public reply the chef can write or edit. */
export default function ReviewReplyCard({ review: loaded }: { review: Review }) {
  const [updated, setUpdated] = useState<Review | null>(null)
  const review = updated ?? loaded
  const [editing, setEditing] = useState(false)
  const [reply, setReply] = useState(loaded.chefResponse ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const text = reply.trim()
    if (text.length < 2) {
      setError('Write a short reply')
      return
    }
    setSaving(true)
    setError(null)
    try {
      setUpdated(await respondToReview(review.id, text))
      setEditing(false)
    } catch (saveError) {
      const apiError = getApiError(saveError)
      setError(apiError.details?.response ?? apiError.message)
    } finally {
      setSaving(false)
    }
  }

  const cancel = () => {
    setEditing(false)
    setReply(review.chefResponse ?? '')
    setError(null)
  }

  return (
    <li className="card review review--dashboard">
      <div className="review-header">
        <Stars rating={review.rating} />
        <span className="review-author">{review.customerName}</span>
        <span className="review-date">{formatReviewDate(review.createdAt)}</span>
      </div>
      <p className="review-meal">
        Ordered <Link to={`/meals/${review.meal.id}`} className="text-link">{review.meal.name}</Link>
      </p>
      {review.comment ? <p className="review-comment">{review.comment}</p> : <p className="card-text">No comment, just stars.</p>}

      {review.chefResponse && !editing && <ChefReply label="Your public reply" text={review.chefResponse} />}

      {editing ? (
        <form className="reply-form" onSubmit={save} noValidate>
          <label className="field-label" htmlFor={`reply-${review.id}`}>
            Your reply <span className="field-optional">(shown publicly under the review)</span>
          </label>
          <textarea
            id={`reply-${review.id}`}
            className="field-input"
            rows={3}
            maxLength={1000}
            value={reply}
            onChange={(event) => setReply(event.target.value)}
          />
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary btn-small" disabled={saving}>
              {saving ? 'Posting...' : 'Post reply'}
            </button>
            <button type="button" className="text-button" onClick={cancel}>Cancel</button>
          </div>
        </form>
      ) : (
        <button type="button" className="text-button" onClick={() => setEditing(true)}>
          {review.chefResponse ? 'Edit reply' : 'Reply'}
        </button>
      )}
    </li>
  )
}
