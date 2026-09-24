import { useState } from 'react'
import { cancelKitchenOrder, updateKitchenOrderStatus } from '../../services/orderService'
import type { KitchenOrder } from '../../types/order.types'
import { getApiError } from '../../utils/apiError'
import { formatPrice } from '../../utils/format'
import { chefActionLabel, formatOrderTime } from '../../utils/orders'
import OrderStatusBadge from './OrderStatusBadge'

interface KitchenOrderCardProps {
  order: KitchenOrder
  /** Called after the order changes, so the list can reload. */
  onChanged: () => Promise<void>
  highlight?: boolean
}

/** One order in the chef's dashboard, with the button for its next step and a way to decline or cancel. */
export default function KitchenOrderCard({ order, onChanged, highlight }: KitchenOrderCardProps) {
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')

  const run = async (action: () => Promise<unknown>) => {
    setWorking(true)
    setError(null)
    try {
      await action()
      setCancelling(false)
      await onChanged()
    } catch (actionError) {
      setError(getApiError(actionError).message)
    } finally {
      // The same card stays on screen with the updated order, ready for its next step.
      setWorking(false)
    }
  }

  const isPending = order.status === 'PENDING'

  return (
    <li className={`card kitchen-order ${highlight ? 'kitchen-order--highlight' : ''}`}>
      <div className="kitchen-order-header">
        <div>
          <p className="kitchen-order-when">{formatOrderTime(order.scheduledFor, order.timezone)}</p>
          <p className="kitchen-order-meta">
            {order.orderNumber} &middot; {order.customer.name} &middot; {order.pickupOrDelivery === 'PICKUP' ? 'Pickup' : 'Delivery'}
          </p>
        </div>
        <OrderStatusBadge status={order.status} handover={order.pickupOrDelivery} />
      </div>

      <ul className="kitchen-order-items">
        {order.items.map((item) => (
          <li key={item.mealId}>
            <strong>{item.quantity} &times;</strong> {item.mealName}
          </li>
        ))}
      </ul>

      {order.pickupOrDelivery === 'DELIVERY' && (
        <p className="kitchen-order-detail">
          <strong>Deliver to:</strong> {order.deliveryAddress}
        </p>
      )}
      {order.contactPhone && (
        <p className="kitchen-order-detail">
          <strong>Phone:</strong> <a href={`tel:${order.contactPhone}`} className="text-link">{order.contactPhone}</a>
        </p>
      )}
      {order.specialInstructions && (
        <p className="kitchen-order-notes">
          <strong>Customer notes:</strong> {order.specialInstructions}
        </p>
      )}
      {order.status === 'CANCELLED' && order.cancellationReason && (
        <p className="kitchen-order-detail">
          <strong>Cancelled:</strong> {order.cancellationReason}
        </p>
      )}

      <p className="kitchen-order-money">
        Total {formatPrice(order.total)} &middot; you receive <strong>{formatPrice(order.chefPayout)}</strong> after the{' '}
        {formatPrice(order.platformFee)} Neighbors Kitchen fee
      </p>

      {error && <p className="field-error" role="alert">{error}</p>}

      {(order.nextStatus || order.canCancel) && !cancelling && (
        <div className="kitchen-order-actions">
          {order.nextStatus && (
            <button
              type="button"
              className="btn btn-primary btn-small"
              disabled={working}
              onClick={() => run(() => updateKitchenOrderStatus(order.id, order.nextStatus!))}
            >
              {chefActionLabel(order.nextStatus, order.pickupOrDelivery)}
            </button>
          )}
          {order.canCancel && (
            <button type="button" className="text-button text-button--danger" disabled={working} onClick={() => setCancelling(true)}>
              {isPending ? 'Decline' : 'Cancel order'}
            </button>
          )}
        </div>
      )}

      {cancelling && (
        <div className="kitchen-order-cancel">
          <label className="field-label" htmlFor={`reason-${order.id}`}>
            Tell {order.customer.name} why (optional)
          </label>
          <input
            id={`reason-${order.id}`}
            type="text"
            className="field-input"
            maxLength={300}
            placeholder="e.g. Sold out of an ingredient that day"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="kitchen-order-actions">
            <button
              type="button"
              className="btn btn-danger btn-small"
              disabled={working}
              onClick={() => run(() => cancelKitchenOrder(order.id, reason.trim() || null))}
            >
              {isPending ? 'Yes, decline order' : 'Yes, cancel order'}
            </button>
            <button type="button" className="text-button" onClick={() => setCancelling(false)}>Go back</button>
          </div>
        </div>
      )}
    </li>
  )
}
