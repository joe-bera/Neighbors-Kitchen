// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Handover, KitchenOrder, OrderStatus } from '../../types/order.types'
import KitchenOrderCard from './KitchenOrderCard'

// The card talks to the API through these two calls; replace them so no network is needed.
vi.mock('../../services/orderService', () => ({
  updateKitchenOrderStatus: vi.fn().mockResolvedValue({}),
  cancelKitchenOrder: vi.fn().mockResolvedValue({}),
}))

function kitchenOrder(status: OrderStatus, nextStatus: OrderStatus | null): KitchenOrder {
  return {
    id: 'order-1',
    orderNumber: 'NK-ABC234',
    status,
    nextStatus,
    paymentStatus: 'PENDING',
    pickupOrDelivery: 'PICKUP',
    scheduledFor: '2026-09-30T01:00:00.000Z',
    timezone: 'America/Los_Angeles',
    subtotal: 28,
    deliveryFee: 0,
    total: 28,
    platformFee: 2.8,
    chefPayout: 25.2,
    deliveryAddress: null,
    contactPhone: null,
    specialInstructions: null,
    cancellationReason: null,
    cancelledAt: null,
    completedAt: null,
    createdAt: '2026-09-24T03:00:00.000Z',
    chef: { id: 'chef-1', kitchenName: "Abuela's Table", chefName: 'Maria D.', city: 'Redlands', state: 'CA', isAcceptingOrders: true },
    customer: { name: 'Chris W.' },
    items: [{ mealId: 'meal-1', mealName: 'Enchiladas', quantity: 2, priceAtPurchase: 14, lineTotal: 28 }],
    events: [],
    canCancel: true,
    deliveryDistanceMiles: null,
  }
}

afterEach(cleanup)

describe('KitchenOrderCard', () => {
  it('lets the chef take the next step right after finishing the previous one', async () => {
    const onChanged = vi.fn().mockResolvedValue(undefined)
    const { rerender } = render(<KitchenOrderCard order={kitchenOrder('CONFIRMED', 'PREPARING')} onChanged={onChanged} />)

    fireEvent.click(screen.getByRole('button', { name: 'Start preparing' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    // The list reloads and hands the same card the updated order.
    rerender(<KitchenOrderCard order={kitchenOrder('PREPARING', 'READY')} onChanged={onChanged} />)

    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Mark ready for pickup' }) as HTMLButtonElement).disabled).toBe(false),
    )
  })

  it('shows roughly how far away a delivery is', () => {
    const delivery = {
      ...kitchenOrder('CONFIRMED', 'PREPARING'),
      pickupOrDelivery: 'DELIVERY' as Handover,
      deliveryAddress: '1 Orange St, Redlands, CA 92373',
      deliveryDistanceMiles: 3.2,
    }

    render(<KitchenOrderCard order={delivery} onChanged={vi.fn()} />)

    expect(screen.getByText(/1 Orange St, Redlands, CA 92373/).textContent).toContain('(3.2 miles away)')
  })
})
