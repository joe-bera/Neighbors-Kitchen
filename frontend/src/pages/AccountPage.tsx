import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import PageLoader from '../components/common/PageLoader'
import { usePageTitle } from '../hooks/usePageTitle'
import { fetchCurrentUser } from '../services/authService'
import type { ChefProfileSummary, CurrentUser } from '../types/user.types'
import { getApiError } from '../utils/apiError'
import './AccountPage.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; user: CurrentUser }

export default function AccountPage() {
  usePageTitle('My account')
  const location = useLocation()
  const navigate = useNavigate()
  const [justSignedUp] = useState(() => (location.state as { justSignedUp?: boolean } | null)?.justSignedUp === true)
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  // Show the sign-up welcome only once: clear it from browser history so a reload won't repeat it.
  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  useEffect(() => {
    let cancelled = false
    fetchCurrentUser()
      .then((user) => {
        if (!cancelled) setState({ status: 'ready', user })
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: 'error', message: getApiError(error).message })
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const retry = () => {
    setState({ status: 'loading' })
    setAttempt((count) => count + 1)
  }

  if (state.status === 'loading') return <PageLoader label="Loading your account" />

  if (state.status === 'error') {
    return (
      <div className="container account">
        <div className="alert alert-error" role="alert">{state.message}</div>
        <button type="button" className="btn btn-primary" onClick={retry}>Try again</button>
      </div>
    )
  }

  const { user } = state
  const isChef = user.role === 'CHEF'
  const memberSince = new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="container account">
      {justSignedUp && (
        <div className="alert alert-success" role="status">
          Your account is ready. Welcome to Neighbors Kitchen!
        </div>
      )}

      <header className="account-header">
        <h1>Welcome, {user.firstName}</h1>
        <p>{isChef ? 'Your account details and a snapshot of your kitchen.' : 'Your home for ordering from local chefs.'}</p>
      </header>

      <div className="account-grid">
        <section className="card" aria-labelledby="account-details-heading">
          <h2 id="account-details-heading">Account details</h2>
          <dl className="detail-list">
            <div>
              <dt>Name</dt>
              <dd>{user.firstName} {user.lastName}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Account type</dt>
              <dd><span className="chip">{isChef ? 'Chef' : 'Customer'}</span></dd>
            </div>
            <div>
              <dt>Member since</dt>
              <dd>{memberSince}</dd>
            </div>
          </dl>
        </section>

        {isChef && user.chefProfile && <KitchenCard kitchen={user.chefProfile} ownerFirstName={user.firstName} />}

        {isChef && !user.chefProfile && (
          <section className="card" aria-labelledby="setup-heading">
            <h2 id="setup-heading">Set up your kitchen</h2>
            <p className="card-text">
              Add your kitchen name, a short bio and where you cook. Then you can add meals and your weekly hours.
            </p>
            <div className="card-actions">
              <Link to="/chef/setup" className="btn btn-primary">Set up my kitchen</Link>
            </div>
          </section>
        )}

        {!isChef && (
          <section className="card" aria-labelledby="next-meal-heading">
            <h2 id="next-meal-heading">Find your next meal</h2>
            <p className="card-text">
              See what the chefs near you are cooking this week and pre-order for pickup or delivery.
            </p>
            <div className="card-actions">
              <Link to="/meals" className="btn btn-primary">Browse meals</Link>
              <Link to="/orders" className="btn btn-outline">Your orders</Link>
            </div>
          </section>
        )}

        {!isChef && (
          <section className="card" aria-labelledby="cook-heading">
            <h2 id="cook-heading">Love to cook?</h2>
            <p className="card-text">
              Share your cooking with neighbors and earn money from your kitchen. You can still order from other chefs.
            </p>
            <div className="card-actions">
              <Link to="/chef/setup" className="btn btn-outline">Become a chef</Link>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function KitchenCard({ kitchen, ownerFirstName }: { kitchen: ChefProfileSummary; ownerFirstName: string }) {
  return (
    <section className="card" aria-labelledby="kitchen-heading">
      <h2 id="kitchen-heading">Your kitchen</h2>
      <p className="kitchen-name">{kitchen.kitchenName ?? `${ownerFirstName}'s Kitchen`}</p>
      <p className="kitchen-location">{kitchen.city}, {kitchen.state}</p>
      {kitchen.specialties.length > 0 && (
        <div className="chip-row">
          {kitchen.specialties.map((specialty) => (
            <span key={specialty} className="chip">{specialty}</span>
          ))}
        </div>
      )}
      <div className="kitchen-stats">
        <div>
          <strong>{kitchen.mealCount}</strong>
          <span>{kitchen.mealCount === 1 ? 'meal' : 'meals'} on your menu</span>
        </div>
        <div>
          <strong>{kitchen.isAcceptingOrders ? 'Open' : 'Paused'}</strong>
          <span>for new orders</span>
        </div>
      </div>
      <div className="card-actions">
        <Link to="/chef" className="btn btn-primary">Go to your dashboard</Link>
      </div>
    </section>
  )
}
