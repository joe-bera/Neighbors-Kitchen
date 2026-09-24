import type { Handover, OrderStatus } from '../../types/order.types'
import { orderStatusLabel } from '../../utils/orders'

const STEPS: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED']

/** A step-by-step tracker from "sent" to "picked up" or "delivered". Not used for cancelled orders. */
export default function OrderProgress({ status, handover }: { status: OrderStatus; handover: Handover }) {
  const current = STEPS.indexOf(status)
  return (
    <ol className="order-progress" aria-label="Order progress">
      {STEPS.map((step, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'upcoming'
        const label = step === 'PENDING' ? 'Sent to the chef' : orderStatusLabel(step, handover)
        return (
          <li key={step} className={`order-progress-step order-progress-step--${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="order-progress-dot" aria-hidden="true">{state === 'done' ? '✓' : index + 1}</span>
            <span className="order-progress-label">{label}</span>
          </li>
        )
      })}
    </ol>
  )
}
