import { lazy, Suspense } from 'react'
import { Link, useParams } from 'react-router-dom'
import Avatar from '../components/common/Avatar'
import PageLoader from '../components/common/PageLoader'
import Rating from '../components/common/Rating'
import { EmptyState, ErrorState } from '../components/common/StatusStates'
import DishRequests from '../components/feedback/DishRequests'
import ReviewsSection from '../components/feedback/ReviewsSection'
import MealCard from '../components/meal/MealCard'
import MealImage from '../components/meal/MealImage'
import { useAsyncData } from '../hooks/useAsyncData'
import { useOwnKitchenId } from '../hooks/useOwnKitchenId'
import { usePageTitle } from '../hooks/usePageTitle'
import { fetchChef } from '../services/catalogService'
import { describeHandover, formatLeadTime, summarizeAvailability } from '../utils/availability'
import { kitchenTitle } from '../utils/format'
import './ChefProfilePage.css'

// Leaflet only loads on pages that show a map.
const AreaMap = lazy(() => import('../components/location/AreaMap'))

export default function ChefProfilePage() {
  const { id = '' } = useParams()
  const chef = useAsyncData(`chef:${id}`, () => fetchChef(id))
  const ownKitchenId = useOwnKitchenId()
  usePageTitle(chef.data ? kitchenTitle(chef.data) : 'Chef')

  if (chef.status === 'error') {
    return (
      <div className="container">
        <Link to="/chefs" className="back-link">&larr; All chefs</Link>
        <ErrorState message={chef.error ?? ''} onRetry={chef.errorCode === 'NOT_FOUND' ? undefined : chef.retry}>
          <Link to="/chefs" className="btn btn-outline">Browse all chefs</Link>
        </ErrorState>
      </div>
    )
  }
  // Also covers moving from one chef's page to another's, so the old chef never shows.
  if (chef.status === 'loading' || !chef.data) return <PageLoader label="Loading chef" />

  const profile = chef.data
  const title = kitchenTitle(profile)
  const memberSince = new Date(profile.memberSince).getFullYear()
  const hours = summarizeAvailability(profile.availability)

  return (
    <div className="container chef-profile">
      <Link to="/chefs" className="back-link">&larr; All chefs</Link>

      <header className="chef-hero">
        <div className="chef-hero-cover">
          <MealImage src={profile.coverImageUrl} alt="" />
        </div>
        <div className="chef-hero-content">
          <Avatar name={profile.chefName} photoUrl={profile.profilePhotoUrl} size="lg" />
          <div className="chef-hero-text">
            <h1>{title}</h1>
            <p className="chef-hero-by">
              by {profile.chefName} &middot; {profile.city}, {profile.state}
            </p>
            <div className="chef-hero-meta">
              {profile.totalReviews > 0 ? (
                <a href="#reviews" className="rating-link">
                  <Rating average={profile.averageRating} count={profile.totalReviews} />
                </a>
              ) : (
                <Rating average={profile.averageRating} count={profile.totalReviews} />
              )}
              {profile.yearsExperience !== null && <span>{profile.yearsExperience} years cooking</span>}
              <span>On Neighbors Kitchen since {memberSince}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="chef-profile-grid">
        <section className="card chef-about" aria-labelledby="about-heading">
          <h2 id="about-heading">About {profile.firstName}</h2>
          {profile.bio && <p className="chef-bio">{profile.bio}</p>}
          {profile.specialties.length > 0 && (
            <div className="chip-row">
              {profile.specialties.map((specialty) => (
                <span key={specialty} className="chip">{specialty}</span>
              ))}
            </div>
          )}
          <dl className="fact-list">
            {profile.offersDelivery && (
              <div>
                <dt>Delivery</dt>
                <dd>Within {profile.serviceRadiusMiles} miles of their kitchen</dd>
              </div>
            )}
            {profile.certifications.length > 0 && (
              <div>
                <dt>Certifications</dt>
                <dd>
                  <ul className="certification-list">
                    {profile.certifications.map((certification) => (
                      <li key={certification}>{certification}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
          </dl>
        </section>

        <aside className="card chef-order-box" aria-labelledby="order-heading">
          <h2 id="order-heading">Order from {title}</h2>
          <p className={`order-status ${profile.isAcceptingOrders ? 'order-status--open' : ''}`}>
            {profile.isAcceptingOrders ? 'Taking pre-orders' : 'Not taking orders right now'}
          </p>
          <dl className="fact-list order-facts">
            <div>
              <dt>Food is ready</dt>
              <dd>
                {hours.length > 0 ? (
                  <ul className="hours-list">{hours.map((line) => <li key={line}>{line}</li>)}</ul>
                ) : (
                  'Hours coming soon'
                )}
              </dd>
            </div>
            <div>
              <dt>Order ahead</dt>
              <dd>At least {formatLeadTime(profile.orderLeadTimeHours)} before</dd>
            </div>
            <div>
              <dt>Getting your food</dt>
              <dd>{describeHandover(profile)}</dd>
            </div>
          </dl>
          <p className="card-note">Open any meal below to add it to your cart.</p>
        </aside>
      </div>

      <section className="chef-menus" aria-label="Menu">
        {profile.menus.length === 0 ? (
          <EmptyState title="No meals on the menu right now" text="Check back soon for new dishes." />
        ) : (
          profile.menus.map((menu) => (
            <div key={menu.id} className="chef-menu">
              <div className="section-heading">
                <h2>{menu.name}</h2>
              </div>
              {menu.description && <p className="chef-menu-description">{menu.description}</p>}
              <div className="card-grid">
                {menu.meals.map((meal) => (
                  <MealCard key={meal.id} meal={meal} />
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {profile.area && (
        <section className="card chef-area" aria-labelledby="area-heading">
          <h2 id="area-heading">Where {profile.firstName} cooks</h2>
          <Suspense fallback={<div className="map-frame" />}>
            <AreaMap area={profile.area} />
          </Suspense>
          <p className="map-note">
            Shown as an area about a mile across, not an exact address. The pickup address is shared after{' '}
            {profile.firstName} confirms your order.
            {profile.offersDelivery && ` ${profile.firstName} delivers up to ${profile.serviceRadiusMiles} miles.`}
          </p>
        </section>
      )}

      <ReviewsSection
        key={`reviews-${profile.id}`}
        source="chef"
        id={profile.id}
        kitchenName={title}
        average={profile.averageRating}
        count={profile.totalReviews}
      />

      <DishRequests key={`requests-${profile.id}`} chefId={profile.id} kitchenName={title} isOwnKitchen={ownKitchenId === profile.id} />
    </div>
  )
}
