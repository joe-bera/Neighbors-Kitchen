import { Link } from 'react-router-dom'
import PageLoader from '../components/common/PageLoader'
import { EmptyState, ErrorState } from '../components/common/StatusStates'
import OrderStatusBadge from '../components/order/OrderStatusBadge'
import { useAsyncData } from '../hooks/useAsyncData'
import { usePageTitle } from '../hooks/usePageTitle'
import { fetchMyOrders } from '../services/orderService'
import type { CustomerOrder } from '../types/order.types'
import { formatPrice } from '../utils/format'
import { formatOrderTime } from '../utils/orders'
import './Orders.css'

const isOpen = (order: CustomerOrder) => order.status !== 'COMPLETED' && order.status !== 'CANCELLED'

export default function OrdersPage() {
  usePageTitle('Your orders')
  const orders = useAsyncData('my-orders', fetchMyOrders)

  if (orders.status === 'error') {
    return (
      <div className="container">
        <ErrorState message={orders.error ?? ''} onRetry={orders.retry} />
      </div>
    )
  }
  if (!orders.data) return <PageLoader label="Loading your orders" />

  const upcoming = orders.data.filter(isOpen).sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
  const past = orders.data.filter((order) => !isOpen(order))

  return (
    <div className="container orders-page">
      <h1>Your orders</h1>
      {orders.data.length === 0 ? (
        <EmptyState title="No orders yet" text="When you pre-order from a chef, you can follow it here.">
          <Link to="/meals" className="btn btn-primary">Browse meals</Link>
        </EmptyState>
      ) : (
        <>
          <OrderList title="Upcoming" orders={upcoming} emptyText="Nothing on the way right now." />
          <OrderList title="Past orders" orders={past} emptyText="Completed and cancelled orders will show here." />
        </>
      )}
    </div>
  )
}

function OrderList({ title, orders, emptyText }: { title: string; orders: CustomerOrder[]; emptyText: string }) {
  return (
    <section className="orders-section" aria-label={title}>
      <h2>{title}</h2>
      {orders.length === 0 ? (
        <p className="card-text">{emptyText}</p>
      ) : (
        <ul className="order-cards">
          {orders.map((order) => (
            <li key={order.id}>
              <Link to={`/orders/${order.id}`} className="order-card">
                <div className="order-card-header">
                  <span className="order-card-kitchen">{order.chef.kitchenName ?? order.chef.chefName}</span>
                  <OrderStatusBadge status={order.status} handover={order.pickupOrDelivery} />
                </div>
                <p className="order-card-when">
                  {order.pickupOrDelivery === 'PICKUP' ? 'Pickup' : 'Delivery'} &middot; {formatOrderTime(order.scheduledFor, order.timezone)}
                </p>
                <p className="order-card-items">
                  {order.items.map((item) => `${item.quantity} × ${item.mealName}`).join(', ')}
                </p>
                {order.canReview && order.reviews.length < order.items.length && (
                  <p className="order-card-review">Rate your meals &rarr;</p>
                )}
                <p className="order-card-footer">
                  <span>{order.orderNumber}</span>
                  <span className="order-card-total">{formatPrice(order.total)}</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
