import type { Handover, OrderStatus } from '../../types/order.types'
import { orderStatusLabel } from '../../utils/orders'

export default function OrderStatusBadge({ status, handover }: { status: OrderStatus; handover: Handover }) {
  return <span className={`status-badge status-badge--${status.toLowerCase()}`}>{orderStatusLabel(status, handover)}</span>
}
