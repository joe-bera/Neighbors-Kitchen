import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageLoader from '../../components/common/PageLoader'
import PaginationNav from '../../components/common/PaginationNav'
import Rating from '../../components/common/Rating'
import { EmptyState, ErrorState } from '../../components/common/StatusStates'
import RequestCard from '../../components/feedback/RequestCard'
import ReviewReplyCard from '../../components/feedback/ReviewReplyCard'
import '../../components/feedback/Feedback.css'
import { useAsyncData } from '../../hooks/useAsyncData'
import { usePageTitle } from '../../hooks/usePageTitle'
import { fetchMyKitchenReviews, fetchMyKitchenSuggestions } from '../../services/feedbackService'
import type { Suggestion } from '../../types/feedback.types'
import { useChefKitchen } from './chefContext'

const REVIEWS_PER_PAGE = 10

export default function ChefFeedbackPage() {
  usePageTitle('Feedback')
  const [searchParams, setSearchParams] = useSearchParams()
  const view = searchParams.get('view') === 'requests' ? 'requests' : 'reviews'

  return (
    <div className="dashboard-section">
      <div className="pill-group" role="group" aria-label="Which feedback">
        <button type="button" className="pill" aria-pressed={view === 'reviews'} onClick={() => setSearchParams({})}>
          Reviews
        </button>
        <button type="button" className="pill" aria-pressed={view === 'requests'} onClick={() => setSearchParams({ view: 'requests' })}>
          Dish requests
        </button>
      </div>
      {view === 'reviews' ? <KitchenReviews /> : <KitchenRequests />}
    </div>
  )
}

function KitchenReviews() {
  const { kitchen } = useChefKitchen()
  const [page, setPage] = useState(1)
  const reviews = useAsyncData(`kitchen-reviews:${page}`, () => fetchMyKitchenReviews(page, REVIEWS_PER_PAGE))

  if (reviews.status === 'error' && !reviews.data) return <ErrorState message={reviews.error ?? ''} onRetry={reviews.retry} />
  if (!reviews.data) return <PageLoader label="Loading reviews" />
  if (reviews.data.items.length === 0) {
    return (
      <EmptyState
        title="No reviews yet"
        text="When customers rate meals from completed orders, their reviews show up here so you can thank them or reply."
      />
    )
  }

  return (
    <>
      <p className="feedback-summary">
        <Rating average={kitchen.averageRating} count={kitchen.totalReviews} /> Replies show publicly under each review.
      </p>
      <ul className={`review-cards ${reviews.status === 'loading' ? 'is-refreshing' : ''}`}>
        {reviews.data.items.map((review) => (
          <ReviewReplyCard key={review.id} review={review} />
        ))}
      </ul>
      <PaginationNav pagination={reviews.data.pagination} onPageChange={setPage} />
    </>
  )
}

const isOpen = (suggestion: Suggestion) => suggestion.status === 'PENDING' || suggestion.status === 'CONSIDERING'

function KitchenRequests() {
  const requests = useAsyncData('kitchen-requests', fetchMyKitchenSuggestions)

  if (requests.status === 'error' && !requests.data) return <ErrorState message={requests.error ?? ''} onRetry={requests.retry} />
  if (!requests.data) return <PageLoader label="Loading dish requests" />
  if (requests.data.length === 0) {
    return (
      <EmptyState
        title="No dish requests yet"
        text="Neighbors can ask for dishes on your public page and vote for the ones they want most. Their requests will show up here."
      />
    )
  }

  const waiting = requests.data.filter(isOpen)
  const answered = requests.data.filter((suggestion) => !isOpen(suggestion))

  return (
    <>
      {waiting.length > 0 && <RequestGroup title="Waiting for your answer" requests={waiting} />}
      {answered.length > 0 && <RequestGroup title="Answered" requests={answered} />}
    </>
  )
}

function RequestGroup({ title, requests }: { title: string; requests: Suggestion[] }) {
  return (
    <section className="feedback-group" aria-label={title}>
      <h2>
        {title} <span className="kitchen-order-count">({requests.length})</span>
      </h2>
      <ul className="dish-request-list">
        {requests.map((suggestion) => (
          <RequestCard key={suggestion.id} suggestion={suggestion} />
        ))}
      </ul>
    </section>
  )
}
