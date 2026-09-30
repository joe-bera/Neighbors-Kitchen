// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { reportReview } from '../../services/feedbackService'
import type { Review } from '../../types/feedback.types'
import ReviewItem from './ReviewItem'

vi.mock('../../services/feedbackService', () => ({ reportReview: vi.fn().mockResolvedValue(undefined) }))

function review(overrides: Partial<Review> = {}): Review {
  return {
    id: 'review-1',
    rating: 4,
    comment: 'Loved the salsa verde',
    createdAt: '2026-09-20T02:00:00.000Z',
    customerName: 'Chris W.',
    meal: { id: 'meal-1', name: 'Enchiladas' },
    chefResponse: null,
    chefRespondedAt: null,
    ...overrides,
  }
}

// Reviews on a chef's page link to the meal that was ordered.
const renderInRouter = (element: ReactElement) => render(<MemoryRouter>{element}</MemoryRouter>)

afterEach(cleanup)

describe('ReviewItem', () => {
  it("shows the review with the chef's reply", () => {
    renderInRouter(<ReviewItem review={review({ chefResponse: 'Thanks, Chris!' })} kitchenName="Abuela's Table" canReport={false} />)

    expect(screen.getByText('Loved the salsa verde')).toBeTruthy()
    expect(screen.getByText('Thanks, Chris!')).toBeTruthy()
    expect(screen.getByLabelText('4 out of 5 stars')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Report' })).toBeNull()
  })

  it('lets a signed-in reader report a review', async () => {
    renderInRouter(<ReviewItem review={review()} kitchenName="Abuela's Table" canReport />)

    fireEvent.click(screen.getByRole('button', { name: 'Report' }))
    fireEvent.change(screen.getByLabelText(/why/i), { target: { value: 'Rude language' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }))

    await waitFor(() => expect(vi.mocked(reportReview)).toHaveBeenCalledWith('review-1', 'Rude language'))
    expect(await screen.findByText(/we will take a look/i)).toBeTruthy()
  })
})
