import { Link, useParams } from 'react-router-dom'
import Avatar from '../components/common/Avatar'
import PageLoader from '../components/common/PageLoader'
import Rating from '../components/common/Rating'
import { ErrorState } from '../components/common/StatusStates'
import DietaryTags from '../components/meal/DietaryTags'
import MealCard from '../components/meal/MealCard'
import MealImage from '../components/meal/MealImage'
import { useAsyncData } from '../hooks/useAsyncData'
import { usePageTitle } from '../hooks/usePageTitle'
import { fetchMeal } from '../services/catalogService'
import { formatCategory, formatPrepTime, formatPrice } from '../utils/format'
import './MealDetailPage.css'

export default function MealDetailPage() {
  const { id = '' } = useParams()
  const meal = useAsyncData(`meal:${id}`, () => fetchMeal(id))
  usePageTitle(meal.data?.name ?? 'Meal')

  if (meal.status === 'error') {
    return (
      <div className="container">
        <Link to="/meals" className="back-link">&larr; Browse meals</Link>
        <ErrorState message={meal.error ?? ''} onRetry={meal.errorCode === 'NOT_FOUND' ? undefined : meal.retry}>
          <Link to="/meals" className="btn btn-outline">Browse all meals</Link>
        </ErrorState>
      </div>
    )
  }
  // Also covers moving between meals, so the previous meal never shows.
  if (meal.status === 'loading' || !meal.data) return <PageLoader label="Loading meal" />

  const detail = meal.data
  const kitchen = detail.chef.kitchenName ?? detail.chef.chefName

  return (
    <div className="container meal-detail">
      <Link to="/meals" className="back-link">&larr; Browse meals</Link>

      <div className="meal-detail-grid">
        <div className="meal-detail-media">
          <MealImage src={detail.imageUrl} alt={detail.name} />
        </div>

        <div className="meal-detail-info">
          <p className="meal-detail-eyebrow">
            {formatCategory(detail.category)}
            {detail.cuisineType && <> &middot; {detail.cuisineType}</>}
          </p>
          <h1>{detail.name}</h1>
          <div className="meal-detail-price-row">
            <span className="meal-detail-price">{formatPrice(detail.price)}</span>
            <Rating average={detail.averageRating} count={detail.totalReviews} />
          </div>
          <p className="meal-detail-description">{detail.description}</p>
          <DietaryTags tags={detail.dietaryTags} />

          <dl className="meal-facts">
            <div>
              <dt>Serves</dt>
              <dd>{detail.servings}</dd>
            </div>
            <div>
              <dt>Prep time</dt>
              <dd>{formatPrepTime(detail.prepTimeMinutes)}</dd>
            </div>
            {detail.maxOrdersPerDay !== null && (
              <div>
                <dt>Daily limit</dt>
                <dd>{detail.maxOrdersPerDay} orders</dd>
              </div>
            )}
          </dl>

          <div className="meal-order-box">
            <button type="button" className="btn btn-primary btn-block" disabled>
              Add to cart
            </button>
            <p className="card-note">Online ordering opens soon.</p>
          </div>

          <Link to={`/chefs/${detail.chef.id}`} className="meal-chef-link">
            <Avatar name={detail.chef.chefName} />
            <span className="meal-chef-link-text">
              <strong>{kitchen}</strong>
              <span>
                by {detail.chef.chefName} &middot; {detail.chef.city}, {detail.chef.state}
              </span>
            </span>
            <span className="meal-chef-link-cta">View kitchen &rarr;</span>
          </Link>
        </div>
      </div>

      {detail.moreFromChef.length > 0 && (
        <section className="meal-more" aria-labelledby="more-heading">
          <div className="section-heading">
            <h2 id="more-heading">More from {kitchen}</h2>
            <Link to={`/chefs/${detail.chef.id}`} className="text-link">See the full menu</Link>
          </div>
          <div className="card-grid">
            {detail.moreFromChef.map((other) => (
              <MealCard key={other.id} meal={other} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
