import { useState, type FormEvent } from 'react'
import { createReview } from '../../services/feedbackService'
import type { OrderReview } from '../../types/feedback.types'
import type { CustomerOrder } from '../../types/order.types'
import { getApiError } from '../../utils/apiError'
import { ratingWord } from '../../utils/feedback'
import ChefReply from './ChefReply'
import StarRatingInput from './StarRatingInput'
import Stars from './Stars'
import './Feedback.css'

/** On a completed order: a star rating and comment for each meal, or the review already given. */
export default function RateMeals({ order }: { order: CustomerOrder }) {
  const [posted, setPosted] = useState<OrderReview[]>([])
  const kitchen = order.chef.kitchenName ?? order.chef.chefName
  const reviewFor = (mealId: string) =>
    posted.find((review) => review.mealId === mealId) ?? order.reviews.find((review) => review.mealId === mealId)
  const allRated = order.items.every((item) => reviewFor(item.mealId))

  return (
    <section className="card rate-meals" aria-labelledby="rate-heading">
      <h2 id="rate-heading">{allRated ? 'Your reviews' : 'Rate your meals'}</h2>
      {!allRated && (
        <p className="card-text">Your stars help neighbors choose, and help {kitchen} keep cooking what you love.</p>
      )}
      {posted.length > 0 && <p className="alert alert-success" role="status">Thanks! Your review is posted.</p>}
      <ul className="rate-meals-list">
        {order.items.map((item) => {
          const review = reviewFor(item.mealId)
          return (
            <li key={item.mealId} className="rate-meal">
              <h3 className="rate-meal-name">{item.mealName}</h3>
              {review ? (
                <PostedReview review={review} kitchen={kitchen} />
              ) : (
                <MealReviewForm
                  orderId={order.id}
                  mealId={item.mealId}
                  mealName={item.mealName}
                  onPosted={(newReview) => setPosted((list) => [...list, newReview])}
                />
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function PostedReview({ review, kitchen }: { review: OrderReview; kitchen: string }) {
  return (
    <div className="posted-review">
      <p className="posted-review-rating">
        <Stars rating={review.rating} />
        <span>{ratingWord(review.rating)}</span>
      </p>
      {review.comment && <p className="review-comment">{review.comment}</p>}
      {review.chefResponse && <ChefReply label={`Reply from ${kitchen}`} text={review.chefResponse} />}
    </div>
  )
}

interface MealReviewFormProps {
  orderId: string
  mealId: string
  mealName: string
  onPosted: (review: OrderReview) => void
}

function MealReviewForm({ orderId, mealId, mealName, onPosted }: MealReviewFormProps) {
  const [rating, setRating] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [ratingError, setRatingError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (rating === null) {
      setRatingError('Choose from 1 to 5 stars')
      return
    }
    setPosting(true)
    setError(null)
    try {
      const review = await createReview({ orderId, mealId, rating, comment: comment.trim() || null })
      onPosted({
        mealId,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        chefResponse: review.chefResponse,
      })
    } catch (postError) {
      const apiError = getApiError(postError)
      setError(Object.values(apiError.details ?? {})[0] ?? apiError.message)
      setPosting(false)
    }
  }

  return (
    <form className="review-form" onSubmit={submit} noValidate>
      <StarRatingInput
        name={`rating-${mealId}`}
        legend={
          <>
            Your rating<span className="visually-hidden"> for {mealName}</span>
          </>
        }
        value={rating}
        onChange={(stars) => {
          setRating(stars)
          setRatingError(null)
        }}
        error={ratingError}
      />
      <div className="field">
        <label className="field-label" htmlFor={`comment-${mealId}`}>
          Comment <span className="field-optional">(optional)</span>
        </label>
        <textarea
          id={`comment-${mealId}`}
          className="field-input"
          rows={3}
          maxLength={1000}
          placeholder="What did you enjoy? Anything the chef could do better?"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary btn-small" disabled={posting}>
          {posting ? 'Posting...' : 'Post review'}
        </button>
      </div>
    </form>
  )
}
