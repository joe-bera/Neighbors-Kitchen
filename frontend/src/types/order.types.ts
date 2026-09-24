import type { ChefSummary } from './catalog.types'
import type { OrderReview } from './feedback.types'

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED'
export type Handover = 'PICKUP' | 'DELIVERY'

export interface OrderItem {
  mealId: string
  mealName: string
  quantity: number
  priceAtPurchase: number
  lineTotal: number
}

export interface OrderEvent {
  status: OrderStatus
  note: string | null
  createdAt: string
}

interface OrderBase {
  id: string
  orderNumber: string
  status: OrderStatus
  paymentStatus: 'PENDING' | 'PAID' | 'REFUNDED' | 'FAILED'
  pickupOrDelivery: Handover
  scheduledFor: string
  /** The chef's time zone; order times are shown in it. */
  timezone: string
  subtotal: number
  deliveryFee: number
  total: number
  deliveryAddress: string | null
  contactPhone: string | null
  specialInstructions: string | null
  cancellationReason: string | null
  cancelledAt: string | null
  completedAt: string | null
  createdAt: string
  chef: ChefSummary
  items: OrderItem[]
  events: OrderEvent[]
  canCancel: boolean
}

/** An order as its customer sees it. */
export interface CustomerOrder extends OrderBase {
  pickupAddress: string | null
  /** True once the order is completed; each meal can then be rated once. */
  canReview: boolean
  reviews: OrderReview[]
}

/** An order as the chef who received it sees it. */
export interface KitchenOrder extends OrderBase {
  customer: { name: string }
  platformFee: number
  chefPayout: number
  nextStatus: OrderStatus | null
}

export interface OrderSlots {
  timezone: string
  isAcceptingOrders: boolean
  days: { date: string; slots: string[] }[]
}

export interface PlaceOrderInput {
  chefId: string
  items: { mealId: string; quantity: number }[]
  pickupOrDelivery: Handover
  scheduledFor: string
  deliveryAddress: string | null
  contactPhone: string | null
  specialInstructions: string | null
}
