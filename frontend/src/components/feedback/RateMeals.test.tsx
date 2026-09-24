// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createReview } from '../../services/feedbackService'
import type { OrderReview } from '../../types/feedback.types'
import type { CustomerOrder } from '../../types/order.types'
import RateMeals from './RateMeals'

vi.mock('../../services/feedbackService', () => ({ createReview: vi.fn() }))
const createReviewMock = vi.mocked(createReview)

function completedOrder(reviews: OrderReview[] = []): CustomerOrder {
  return {
    id: 'order-1',
    orderNumber: 'NK-ABC234',
    status: 'COMPLETED',
    paymentStatus: 'PENDING',
    pickupOrDelivery: 'PICKUP',
    scheduledFor: '2026-09-30T01:00:00.000Z',
    timezone: 'America/Los_Angeles',
    subtotal: 28,
    deliveryFee: 0,
    total: 28,
    deliveryAddress: null,
    contactPhone: null,
    specialInstructions: null,
    cancellationReason: null,
    cancelledAt: null,
    completedAt: '2026-09-30T01:30:00.000Z',
    createdAt: '2026-09-24T03:00:00.000Z',
    chef: { id: 'chef-1', kitchenName: "Abuela's Table", chefName: 'Maria D.', city: 'Redlands', state: 'CA', isAcceptingOrders: true },
    items: [{ mealId: 'meal-1', mealName: 'Enchiladas', quantity: 2, priceAtPurchase: 14, lineTotal: 28 }],
    events: [],
    canCancel: false,
    pickupAddress: '12 Orange St, Redlands, CA 92373',
    canReview: true,
    reviews,
  }
}

beforeEach(() => createReviewMock.mockReset())
afterEach(cleanup)

describe('RateMeals', () => {
  it('asks for a star rating before posting', async () => {
    render(<RateMeals order={completedOrder()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Post review' }))

    expect(await screen.findByText('Choose from 1 to 5 stars')).toBeTruthy()
    expect(createReviewMock).not.toHaveBeenCalled()
  })

  it('posts the review and shows it in place of the form', async () => {
    createReviewMock.mockResolvedValue({
      id: 'review-1',
      rating: 5,
      comment: 'So good',
      createdAt: '2026-09-30T02:00:00.000Z',
      customerName: 'Chris W.',
      meal: { id: 'meal-1', name: 'Enchiladas' },
      chefResponse: null,
      chefRespondedAt: null,
    })
    render(<RateMeals order={completedOrder()} />)

    fireEvent.click(screen.getByRole('radio', { name: '5 stars' }))
    fireEvent.change(screen.getByLabelText(/comment/i), { target: { value: '  So good ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Post review' }))

    await waitFor(() =>
      expect(createReviewMock).toHaveBeenCalledWith({ orderId: 'order-1', mealId: 'meal-1', rating: 5, comment: 'So good' }),
    )
    expect(await screen.findByText('So good')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Post review' })).toBeNull()
  })

  it('shows meals already rated, with the chef reply', () => {
    render(
      <RateMeals
        order={completedOrder([
          { mealId: 'meal-1', rating: 4, comment: 'Tasty', createdAt: '2026-09-30T02:00:00.000Z', chefResponse: 'Thank you!' },
        ])}
      />,
    )

    expect(screen.getByText('Tasty')).toBeTruthy()
    expect(screen.getByText('Thank you!')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Post review' })).toBeNull()
  })
})
