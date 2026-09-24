import { describe, expect, it } from 'vitest'
import { chefActionLabel, formatOrderTime, formatSlotDay, formatSlotTime, orderStatusLabel } from './orders'

const LA = 'America/Los_Angeles'

describe('orderStatusLabel', () => {
  it.each([
    ['PENDING', 'PICKUP', 'Waiting for the chef'],
    ['CONFIRMED', 'PICKUP', 'Confirmed'],
    ['PREPARING', 'DELIVERY', 'Being prepared'],
    ['READY', 'PICKUP', 'Ready for pickup'],
    ['READY', 'DELIVERY', 'On its way'],
    ['COMPLETED', 'PICKUP', 'Picked up'],
    ['COMPLETED', 'DELIVERY', 'Delivered'],
    ['CANCELLED', 'DELIVERY', 'Cancelled'],
  ] as const)('calls %s %s orders "%s"', (status, handover, expected) => {
    expect(orderStatusLabel(status, handover)).toBe(expected)
  })
})

describe('chefActionLabel', () => {
  it.each([
    ['CONFIRMED', 'PICKUP', 'Confirm order'],
    ['PREPARING', 'PICKUP', 'Start preparing'],
    ['READY', 'PICKUP', 'Mark ready for pickup'],
    ['READY', 'DELIVERY', 'Mark out for delivery'],
    ['COMPLETED', 'PICKUP', 'Mark picked up'],
    ['COMPLETED', 'DELIVERY', 'Mark delivered'],
  ] as const)('labels the step to %s for %s orders "%s"', (next, handover, expected) => {
    expect(chefActionLabel(next, handover)).toBe(expected)
  })
})

describe('time formatting in the chef time zone', () => {
  it('shows a pickup slot as a clock time', () => {
    expect(formatSlotTime('2026-09-30T00:30:00.000Z', LA)).toBe('5:30 PM')
  })

  it('shows a calendar day without shifting it across time zones', () => {
    expect(formatSlotDay('2026-09-29')).toBe('Tue, Sep 29')
  })

  it('shows the full date and time of an order', () => {
    expect(formatOrderTime('2026-09-30T00:30:00.000Z', LA)).toBe('Tuesday, September 29 at 5:30 PM')
  })
})
