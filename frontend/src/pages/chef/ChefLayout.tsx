import { useState } from 'react'
import { Link, Navigate, NavLink, Outlet } from 'react-router-dom'
import PageLoader from '../../components/common/PageLoader'
import { ErrorState } from '../../components/common/StatusStates'
import { useAsyncData } from '../../hooks/useAsyncData'
import { fetchMyKitchen } from '../../services/kitchenService'
import type { OwnKitchen } from '../../types/kitchen.types'
import type { ChefContext } from './chefContext'
import './ChefPages.css'

/** Shell for the chef dashboard: loads the chef's kitchen once and shares it with each tab. */
export default function ChefLayout() {
  const initial = useAsyncData('my-kitchen', fetchMyKitchen)
  const [latest, setLatest] = useState<OwnKitchen | null>(null)
  const kitchen = latest ?? initial.data

  if (initial.status === 'error' && initial.errorCode === 'NO_CHEF_PROFILE') {
    return <Navigate to="/chef/setup" replace />
  }
  if (initial.status === 'error') {
    return (
      <div className="container">
        <ErrorState message={initial.error ?? ''} onRetry={initial.retry} />
      </div>
    )
  }
  if (!kitchen) return <PageLoader label="Loading your kitchen" />

  const context: ChefContext = {
    kitchen,
    setKitchen: setLatest,
    reloadKitchen: async () => setLatest(await fetchMyKitchen()),
  }

  return (
    <div className="container chef-dashboard">
      <header className="chef-dashboard-header">
        <div>
          <p className="chef-dashboard-eyebrow">Chef dashboard</p>
          <h1>{kitchen.kitchenName ?? 'Your kitchen'}</h1>
        </div>
        <div className="chef-dashboard-header-actions">
          <span className={`order-status ${kitchen.isAcceptingOrders ? 'order-status--open' : ''}`}>
            {kitchen.isAcceptingOrders ? 'Taking orders' : 'Orders paused'}
          </span>
          <Link to={`/chefs/${kitchen.id}`} className="text-link">View your public page &rarr;</Link>
        </div>
      </header>

      <nav className="dashboard-tabs" aria-label="Chef dashboard">
        <NavLink to="/chef" end className="dashboard-tab">Overview</NavLink>
        <NavLink to="/chef/orders" className="dashboard-tab">Orders</NavLink>
        <NavLink to="/chef/meals" className="dashboard-tab">Meals</NavLink>
        <NavLink to="/chef/availability" className="dashboard-tab">Hours &amp; delivery</NavLink>
        <NavLink to="/chef/kitchen" className="dashboard-tab">Kitchen profile</NavLink>
      </nav>

      <Outlet context={context} />
    </div>
  )
}
