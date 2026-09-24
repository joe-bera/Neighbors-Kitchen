import { useState } from 'react'
import { Link } from 'react-router-dom'
import Rating from '../../components/common/Rating'
import Toggle from '../../components/common/Toggle'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useFlashMessage } from '../../hooks/useFlashMessage'
import { usePageTitle } from '../../hooks/usePageTitle'
import { updateMyKitchen } from '../../services/kitchenService'
import { fetchKitchenOrders } from '../../services/orderService'
import { getApiError } from '../../utils/apiError'
import { describeHandover, formatLeadTime, summarizeAvailability } from '../../utils/availability'
import { useChefKitchen } from './chefContext'

export default function ChefOverviewPage() {
  usePageTitle('Chef dashboard')
  const { kitchen, setKitchen } = useChefKitchen()
  const flash = useFlashMessage()
  const activeOrders = useAsyncData('overview-orders', () => fetchKitchenOrders('active'))
  const waitingCount = activeOrders.data?.filter((order) => order.status === 'PENDING').length ?? 0
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setTakingOrders = async (isAcceptingOrders: boolean) => {
    setSaving(true)
    setError(null)
    try {
      setKitchen(await updateMyKitchen({ isAcceptingOrders }))
    } catch (updateError) {
      setError(getApiError(updateError).message)
    } finally {
      setSaving(false)
    }
  }

  const steps = [
    { done: true, label: 'Set up your kitchen profile', to: '/chef/kitchen' },
    { done: kitchen.mealCount > 0, label: 'Add your first meal', to: '/chef/meals/new' },
    { done: kitchen.availability.length > 0, label: 'Set your weekly hours', to: '/chef/availability' },
  ]
  const stepsLeft = steps.filter((step) => !step.done).length
  const hours = summarizeAvailability(kitchen.availability)

  return (
    <div className="dashboard-section">
      {flash && <div className="alert alert-success" role="status">{flash}</div>}

      {waitingCount > 0 && (
        <div className="alert alert-info overview-orders-alert" role="status">
          <strong>
            {waitingCount} new {waitingCount === 1 ? 'order needs' : 'orders need'} your confirmation.
          </strong>
          <Link to="/chef/orders" className="btn btn-primary btn-small">Review orders</Link>
        </div>
      )}

      {stepsLeft > 0 && (
        <section className="card checklist" aria-labelledby="checklist-heading">
          <h2 id="checklist-heading">Get ready for your first order</h2>
          <p className="card-text">
            {stepsLeft} {stepsLeft === 1 ? 'step' : 'steps'} left before neighbors can order from you.
          </p>
          <ol className="checklist-steps">
            {steps.map((step) => (
              <li key={step.label} className={step.done ? 'is-done' : undefined}>
                <span className="checklist-mark" aria-hidden="true">{step.done ? '✓' : ''}</span>
                {step.done ? <span>{step.label}</span> : <Link to={step.to} className="text-link">{step.label}</Link>}
                <span className="visually-hidden">{step.done ? ' (done)' : ' (to do)'}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-value">{kitchen.mealCount}</span>
          <span className="stat-label">{kitchen.mealCount === 1 ? 'meal' : 'meals'} on your menu</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{kitchen.totalOrders}</span>
          <span className="stat-label">orders so far</span>
        </div>
        <div className="stat-card">
          <span className="stat-value stat-value--rating">
            <Rating average={kitchen.averageRating} count={kitchen.totalReviews} />
          </span>
          <span className="stat-label">rating from customers</span>
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="card" aria-labelledby="orders-heading">
          <h2 id="orders-heading">New orders</h2>
          <p className="card-text">
            {kitchen.isAcceptingOrders
              ? 'Neighbors can pre-order during your hours.'
              : 'New orders are paused. Customers can still see your menu.'}
          </p>
          <Toggle label="Taking new orders" checked={kitchen.isAcceptingOrders} disabled={saving} onChange={setTakingOrders} />
          {error && <p className="field-error" role="alert">{error}</p>}
        </section>

        <section className="card" aria-labelledby="hours-heading">
          <h2 id="hours-heading">Your hours</h2>
          {hours.length > 0 ? (
            <ul className="hours-list">
              {hours.map((line) => <li key={line}>{line}</li>)}
            </ul>
          ) : (
            <p className="card-text">You have not set your weekly hours yet.</p>
          )}
          <p className="card-text">
            Orders needed {formatLeadTime(kitchen.orderLeadTimeHours)} ahead &middot; {describeHandover(kitchen)}
          </p>
          <Link to="/chef/availability" className="text-link">Edit hours and delivery</Link>
        </section>
      </div>
    </div>
  )
}
