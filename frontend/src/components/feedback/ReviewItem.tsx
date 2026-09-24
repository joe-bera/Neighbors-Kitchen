import { useState } from 'react'
import { Link } from 'react-router-dom'
import { reportReview } from '../../services/feedbackService'
import type { Review } from '../../types/feedback.types'
import { getApiError } from '../../utils/apiError'
import { formatReviewDate } from '../../utils/feedback'
import ChefReply from './ChefReply'
import Stars from './Stars'

interface ReviewItemProps {
  review: Review
  kitchenName: string
  /** Signed-in readers can report a review for a moderator to look at. */
  canReport: boolean
  /** Name the meal that was reviewed (useful on a chef's page, not on the meal's own page). */
  showMealName?: boolean
}

export default function ReviewItem({ review, kitchenName, canReport, showMealName = true }: ReviewItemProps) {
  return (
    <li className="review">
      <div className="review-header">
        <Stars rating={review.rating} />
        <span className="review-author">{review.customerName}</span>
        <span className="review-date">{formatReviewDate(review.createdAt)}</span>
      </div>
      {showMealName && (
        <p className="review-meal">
          Ordered <Link to={`/meals/${review.meal.id}`} className="text-link">{review.meal.name}</Link>
        </p>
      )}
      {review.comment && <p className="review-comment">{review.comment}</p>}
      {review.chefResponse && <ChefReply label={`Reply from ${kitchenName}`} text={review.chefResponse} />}
      {canReport && <ReportReview reviewId={review.id} />}
    </li>
  )
}

function ReportReview({ reviewId }: { reviewId: string }) {
  const [step, setStep] = useState<'closed' | 'open' | 'sending' | 'sent'>('closed')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (step === 'sent') {
    return <p className="review-report-done" role="status">Thanks for letting us know. We will take a look.</p>
  }
  if (step === 'closed') {
    return (
      <button type="button" className="text-button review-report-button" onClick={() => setStep('open')}>
        Report
      </button>
    )
  }

  const send = async () => {
    setStep('sending')
    setError(null)
    try {
      await reportReview(reviewId, reason.trim() || null)
      setStep('sent')
    } catch (sendError) {
      setError(getApiError(sendError).message)
      setStep('open')
    }
  }

  return (
    <div className="review-report">
      <label className="field-label" htmlFor={`report-${reviewId}`}>
        Why are you reporting this review? <span className="field-optional">(optional)</span>
      </label>
      <input
        id={`report-${reviewId}`}
        type="text"
        className="field-input"
        maxLength={300}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn btn-outline btn-small" disabled={step === 'sending'} onClick={send}>
          {step === 'sending' ? 'Sending...' : 'Send report'}
        </button>
        <button type="button" className="text-button" onClick={() => setStep('closed')}>Cancel</button>
      </div>
    </div>
  )
}
