import type { Handover, OrderStatus } from '../types/order.types'

const STATUS_LABELS: Record<Exclude<OrderStatus, 'READY' | 'COMPLETED'>, string> = {
  PENDING: 'Waiting for the chef',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Being prepared',
  CANCELLED: 'Cancelled',
}

/** What customers and chefs call the order's status, which depends on pickup or delivery. */
export function orderStatusLabel(status: OrderStatus, handover: Handover): string {
  if (status === 'READY') return handover === 'PICKUP' ? 'Ready for pickup' : 'On its way'
  if (status === 'COMPLETED') return handover === 'PICKUP' ? 'Picked up' : 'Delivered'
  return STATUS_LABELS[status]
}

/** The button a chef presses to move an order to `next`. */
export function chefActionLabel(next: OrderStatus, handover: Handover): string {
  switch (next) {
    case 'CONFIRMED':
      return 'Confirm order'
    case 'PREPARING':
      return 'Start preparing'
    case 'READY':
      return handover === 'PICKUP' ? 'Mark ready for pickup' : 'Mark out for delivery'
    case 'COMPLETED':
      return handover === 'PICKUP' ? 'Mark picked up' : 'Mark delivered'
    default:
      return ''
  }
}

// Newer browsers put a narrow no-break space before AM/PM; use a regular space everywhere.
const normalizeSpaces = (text: string) => text.replace(/\u202f/g, ' ')

/** A UTC time shown as a clock time in the chef's time zone, e.g. "5:30 PM". */
export function formatSlotTime(iso: string, timezone: string): string {
  return normalizeSpaces(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timezone }).format(new Date(iso)),
  )
}

/** A calendar date such as "2026-09-29" shown as "Tue, Sep 29" (the date itself never shifts). */
export function formatSlotDay(date: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${date}T12:00:00Z`),
  )
}

/** E.g. "Tuesday, September 29 at 5:30 PM", in the chef's time zone. */
export function formatOrderTime(iso: string, timezone: string): string {
  const day = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: timezone }).format(
    new Date(iso),
  )
  return `${day} at ${formatSlotTime(iso, timezone)}`
}
