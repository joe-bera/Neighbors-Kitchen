import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PageLoader from '../components/common/PageLoader'
import { ErrorState } from '../components/common/StatusStates'
import OrderProgress from '../components/order/OrderProgress'
import OrderStatusBadge from '../components/order/OrderStatusBadge'
import { useAsyncData } from '../hooks/useAsyncData'
import { useFlashMessage } from '../hooks/useFlashMessage'
import { usePageTitle } from '../hooks/usePageTitle'
import { cancelOrder, fetchOrder } from '../services/orderService'
import type { CustomerOrder } from '../types/order.types'
import { getApiError } from '../utils/apiError'
import { formatPrice } from '../utils/format'
import { formatOrderTime, orderStatusLabel } from '../utils/orders'
import './Orders.css'

const REFRESH_EVERY_MS = 30_000

export default function OrderDetailPage() {
  const { id = '' } = useParams()
  usePageTitle('Order details')
  const flash = useFlashMessage()
  const order = useAsyncData(`order:${id}`, () => fetchOrder(id))
  const [cancelled, setCancelled] = useState<CustomerOrder | null>(null)
  const current = cancelled ?? order.data
  const isOpen = current !== undefined && current.status !== 'COMPLETED' && current.status !== 'CANCELLED'
  const { retry } = order

  // Check for updates from the chef while the order is in progress.
  useEffect(() => {
    if (!isOpen) return
    const timer = window.setInterval(retry, REFRESH_EVERY_MS)
    return () => window.clearInterval(timer)
  }, [isOpen, retry])

  if (!current && order.status === 'error') {
    return (
      <div className="container">
        <Link to="/orders" className="back-link">&larr; Your orders</Link>
        <ErrorState message={order.error ?? ''} onRetry={order.errorCode === 'NOT_FOUND' ? undefined : order.retry} />
      </div>
    )
  }
  if (!current) return <PageLoader label="Loading your order" />

  const handoverWord = current.pickupOrDelivery === 'PICKUP' ? 'Pickup' : 'Delivery'

  return (
    <div className="container order-detail">
      <Link to="/orders" className="back-link">&larr; Your orders</Link>
      {flash && <div className="alert alert-success" role="status">{flash}</div>}

      <header className="order-detail-header">
        <div>
          <p className="order-detail-number">Order {current.orderNumber}</p>
          <h1>{current.chef.kitchenName ?? current.chef.chefName}</h1>
        </div>
        <OrderStatusBadge status={current.status} handover={current.pickupOrDelivery} />
      </header>

      {current.status === 'CANCELLED' ? (
        <div className="alert alert-error" role="status">
          This order was cancelled{current.cancellationReason ? `: ${current.cancellationReason}` : '.'}
        </div>
      ) : (
        <div className="card">
          <OrderProgress status={current.status} handover={current.pickupOrDelivery} />
        </div>
      )}

      <div className="order-detail-grid">
        <section className="card" aria-labelledby="when-heading">
          <h2 id="when-heading">{handoverWord}</h2>
          <p className="order-detail-when">{formatOrderTime(current.scheduledFor, current.timezone)}</p>
          {current.pickupOrDelivery === 'PICKUP' ? (
            current.pickupAddress ? (
              <p>
                <strong>Pick up at:</strong> {current.pickupAddress}
              </p>
            ) : (
              <p className="card-text">The chef&apos;s pickup address will appear here once they confirm your order.</p>
            )
          ) : (
            <p>
              <strong>Deliver to:</strong> {current.deliveryAddress}
            </p>
          )}
          {current.contactPhone && <p className="card-text">Your phone: {current.contactPhone}</p>}
          {current.specialInstructions && (
            <p className="card-text">
              <strong>Your notes:</strong> {current.specialInstructions}
            </p>
          )}
          <Link to={`/chefs/${current.chef.id}`} className="text-link">
            About {current.chef.kitchenName ?? current.chef.chefName} &rarr;
          </Link>
        </section>

        <section className="card" aria-labelledby="items-heading">
          <h2 id="items-heading">What you ordered</h2>
          <ul className="summary-items">
            {current.items.map((item) => (
              <li key={item.mealId} className="summary-row">
                <span>{item.quantity} &times; {item.mealName}</span>
                <span>{formatPrice(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <div className="summary-row">
            <span>Subtotal</span>
            <span>{formatPrice(current.subtotal)}</span>
          </div>
          {current.pickupOrDelivery === 'DELIVERY' && (
            <div className="summary-row">
              <span>Delivery</span>
              <span>{current.deliveryFee > 0 ? formatPrice(current.deliveryFee) : 'Free'}</span>
            </div>
          )}
          <div className="summary-row summary-row--total">
            <span>Total</span>
            <span>{formatPrice(current.total)}</span>
          </div>
        </section>
      </div>

      {current.canCancel && <CancelOrder orderId={current.id} onCancelled={setCancelled} />}

      <section className="card" aria-labelledby="history-heading">
        <h2 id="history-heading">History</h2>
        <ol className="order-history">
          {current.events.map((event) => (
            <li key={`${event.status}-${event.createdAt}`}>
              <span className="order-history-status">
                {event.status === 'PENDING' ? 'Order sent' : orderStatusLabel(event.status, current.pickupOrDelivery)}
              </span>
              <span className="order-history-time">{formatOrderTime(event.createdAt, current.timezone)}</span>
              {event.note && <span className="order-history-note">{event.note}</span>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

function CancelOrder({ orderId, onCancelled }: { orderId: string; onCancelled: (order: CustomerOrder) => void }) {
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    setWorking(true)
    setError(null)
    try {
      onCancelled(await cancelOrder(orderId, reason.trim() || null))
    } catch (cancelError) {
      setError(getApiError(cancelError).message)
      setWorking(false)
    }
  }

  if (!confirming) {
    return (
      <div className="order-cancel">
        <button type="button" className="text-button text-button--danger" onClick={() => setConfirming(true)}>
          Cancel this order
        </button>
      </div>
    )
  }

  return (
    <section className="card order-cancel-confirm" aria-labelledby="cancel-heading">
      <h2 id="cancel-heading">Cancel this order?</h2>
      <div className="field">
        <label className="field-label" htmlFor="cancelReason">
          Reason <span className="field-optional">(optional, shared with the chef)</span>
        </label>
        <input id="cancelReason" type="text" className="field-input" maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} />
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn btn-danger" disabled={working} onClick={confirm}>
          {working ? 'Cancelling...' : 'Yes, cancel order'}
        </button>
        <button type="button" className="btn btn-outline" onClick={() => setConfirming(false)}>Keep my order</button>
      </div>
    </section>
  )
}
