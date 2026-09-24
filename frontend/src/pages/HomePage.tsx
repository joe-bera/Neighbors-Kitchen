import { Link, useNavigate } from 'react-router-dom'
import ChefCard from '../components/chef/ChefCard'
import PageLoader from '../components/common/PageLoader'
import SearchForm from '../components/common/SearchForm'
import Footer from '../components/layout/Footer'
import Navbar from '../components/layout/Navbar'
import MealCard from '../components/meal/MealCard'
import { useAsyncData } from '../hooks/useAsyncData'
import { usePageTitle } from '../hooks/usePageTitle'
import { fetchChefs, fetchMeals } from '../services/catalogService'
import { useAuthStore } from '../store/authStore'
import { pickOnePerChef } from '../utils/featured'
import './HomePage.css'

const FEATURED_COUNT = 4
// Load extra meals so the featured row can show one dish from each of several chefs.
const FEATURED_MEAL_POOL = new URLSearchParams({ limit: '40' })
const FEATURED_CHEFS = new URLSearchParams({ limit: String(FEATURED_COUNT) })

export default function HomePage() {
  usePageTitle()
  const navigate = useNavigate()
  const status = useAuthStore((state) => state.status)
  const becomeChefLink = status === 'authenticated' ? '/account' : '/signup?role=chef'

  const searchMeals = (value: string) => {
    navigate(value ? `/meals?${new URLSearchParams({ search: value })}` : '/meals')
  }

  return (
    <div className="app-shell">
      {/* Hero Section */}
      <header className="hero">
        <Navbar variant="transparent" />

        <div className="hero-content">
          <h1>Discover Amazing Home-Cooked Meals from Local Chefs</h1>
          <p className="hero-subtitle">
            Connect with talented chefs in your neighborhood. Order delicious,
            authentic meals made with love, right in your community.
          </p>
          <SearchForm
            variant="hero"
            initialValue=""
            label="Search meals"
            placeholder="What are you craving? Try tacos, pho or vegan"
            onSearch={searchMeals}
          />
          <div className="hero-buttons">
            <Link to="/chefs" className="btn btn-large btn-light">Browse Chefs</Link>
            <Link to={becomeChefLink} className="btn btn-large btn-outline-light">Become a Chef</Link>
          </div>
        </div>
      </header>

      <FeaturedMeals />
      <FeaturedChefs />

      {/* Features Section */}
      <section id="features" className="features">
        <h2>Why Choose Neighbors Kitchen?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">👨‍🍳</div>
            <h3>Local Chefs</h3>
            <p>Discover talented chefs in your neighborhood with diverse culinary backgrounds</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🍽️</div>
            <h3>Fresh Meals</h3>
            <p>Enjoy freshly prepared, home-cooked meals made with quality ingredients</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📅</div>
            <h3>Pre-Order</h3>
            <p>Browse menus and pre-order meals for pickup or delivery at your convenience</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">⭐</div>
            <h3>Reviews & Ratings</h3>
            <p>Read authentic reviews from neighbors and build trust in your community</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">💳</div>
            <h3>Secure Payments</h3>
            <p>Safe and easy payment processing with transparent pricing</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🌍</div>
            <h3>Community Driven</h3>
            <p>Support local talent and build connections with your neighbors</p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="how-it-works">
        <h2>How It Works</h2>
        <div className="steps">
          <div className="step">
            <div className="step-number">1</div>
            <h3>Find Local Chefs</h3>
            <p>Browse chef profiles and menus in your neighborhood</p>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <h3>Place Your Order</h3>
            <p>Select your favorite meals and schedule pickup or delivery</p>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <h3>Enjoy Your Meal</h3>
            <p>Pick up your freshly prepared meal and enjoy delicious home cooking</p>
          </div>
          <div className="step">
            <div className="step-number">4</div>
            <h3>Leave a Review</h3>
            <p>Share your experience and help others discover great local chefs</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <h2>Ready to Get Started?</h2>
        <p>Join our community of food lovers and talented chefs today!</p>
        <div className="cta-buttons">
          <Link to="/chefs" className="btn btn-large btn-light">Find Chefs Near You</Link>
          <Link to={becomeChefLink} className="btn btn-large btn-outline-light">Become a Chef</Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}

function FeaturedMeals() {
  const meals = useAsyncData('home:meals', async () => {
    const pool = await fetchMeals(FEATURED_MEAL_POOL)
    return pickOnePerChef(pool.items, FEATURED_COUNT)
  })
  if (meals.status === 'error' || meals.data?.length === 0) return null

  return (
    <section className="home-section" aria-labelledby="popular-heading">
      <div className="home-section-inner">
        <div className="section-heading">
          <h2 id="popular-heading">Popular right now</h2>
          <Link to="/meals" className="text-link">See all meals &rarr;</Link>
        </div>
        {meals.data ? (
          <div className="card-grid card-grid--four">
            {meals.data.map((meal) => (
              <MealCard key={meal.id} meal={meal} chef={meal.chef} />
            ))}
          </div>
        ) : (
          <PageLoader label="Loading meals" />
        )}
      </div>
    </section>
  )
}

function FeaturedChefs() {
  const chefs = useAsyncData('home:chefs', () => fetchChefs(FEATURED_CHEFS))
  if (chefs.status === 'error' || chefs.data?.items.length === 0) return null

  return (
    <section className="home-section home-section--muted" aria-labelledby="chefs-heading">
      <div className="home-section-inner">
        <div className="section-heading">
          <h2 id="chefs-heading">Meet your neighborhood chefs</h2>
          <Link to="/chefs" className="text-link">See all chefs &rarr;</Link>
        </div>
        {chefs.data ? (
          <div className="card-grid card-grid--four">
            {chefs.data.items.map((chef) => (
              <ChefCard key={chef.id} chef={chef} />
            ))}
          </div>
        ) : (
          <PageLoader label="Loading chefs" />
        )}
      </div>
    </section>
  )
}
