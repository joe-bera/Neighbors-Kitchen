import { Link, useParams } from 'react-router-dom'
import Avatar from '../components/common/Avatar'
import PageLoader from '../components/common/PageLoader'
import Rating from '../components/common/Rating'
import { EmptyState, ErrorState } from '../components/common/StatusStates'
import MealCard from '../components/meal/MealCard'
import MealImage from '../components/meal/MealImage'
import { useAsyncData } from '../hooks/useAsyncData'
import { usePageTitle } from '../hooks/usePageTitle'
import { fetchChef } from '../services/catalogService'
import { kitchenTitle } from '../utils/format'
import './ChefProfilePage.css'

export default function ChefProfilePage() {
  const { id = '' } = useParams()
  const chef = useAsyncData(`chef:${id}`, () => fetchChef(id))
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
              <Rating average={profile.averageRating} count={profile.totalReviews} />
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
            <div>
              <dt>Service area</dt>
              <dd>Within {profile.serviceRadiusMiles} miles of {profile.city}</dd>
            </div>
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
          <p className="card-note">
            Online ordering opens soon. Browse the menu below to see what {profile.firstName} is cooking.
          </p>
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
    </div>
  )
}
