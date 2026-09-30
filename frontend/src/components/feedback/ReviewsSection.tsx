import { useState } from 'react'
import { useAsyncData } from '../../hooks/useAsyncData'
import { fetchChefReviews, fetchMealReviews } from '../../services/feedbackService'
import { useAuthStore } from '../../store/authStore'
import PaginationNav from '../common/PaginationNav'
import { ErrorState } from '../common/StatusStates'
import ReviewItem from './ReviewItem'
import Stars from './Stars'
import './Feedback.css'

const PAGE_SIZE = 5

interface ReviewsSectionProps {
  /** Whose reviews: a chef's (all their meals) or a single meal's. */
  source: 'chef' | 'meal'
  id: string
  kitchenName: string
  average: number | null
  count: number
}

/** Public reviews with the average rating, newest first, a few at a time. */
export default function ReviewsSection({ source, id, kitchenName, average, count }: ReviewsSectionProps) {
  const [page, setPage] = useState(1)
  const isSignedIn = useAuthStore((state) => state.status === 'authenticated')
  const reviews = useAsyncData(`reviews:${source}:${id}:${page}`, () =>
    source === 'chef' ? fetchChefReviews(id, page, PAGE_SIZE) : fetchMealReviews(id, page, PAGE_SIZE),
  )

  return (
    <section className="reviews-section" id="reviews" aria-labelledby="reviews-heading">
      <div className="section-heading">
        <h2 id="reviews-heading">Reviews</h2>
      </div>
      <div className="card">
        {average !== null && count > 0 ? (
          <div className="reviews-summary">
            <span className="reviews-average">{average.toFixed(1)}</span>
            <span className="reviews-summary-text">
              <Stars rating={average} />
              <span>Based on {count === 1 ? '1 review' : `${count} reviews`} from neighbors who ordered</span>
            </span>
          </div>
        ) : (
          <p className="card-text">
            No reviews yet. Reviews come from neighbors after they pick up or receive their order.
          </p>
        )}

        {reviews.status === 'error' && !reviews.data && <ErrorState message={reviews.error ?? ''} onRetry={reviews.retry} />}
        {reviews.data && reviews.data.items.length > 0 && (
          <>
            <ul className={`review-list ${reviews.status === 'loading' ? 'is-refreshing' : ''}`}>
              {reviews.data.items.map((review) => (
                <ReviewItem
                  key={review.id}
                  review={review}
                  kitchenName={kitchenName}
                  canReport={isSignedIn}
                  showMealName={source === 'chef'}
                />
              ))}
            </ul>
            <PaginationNav pagination={reviews.data.pagination} onPageChange={setPage} />
          </>
        )}
      </div>
    </section>
  )
}
