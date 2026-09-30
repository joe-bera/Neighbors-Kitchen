// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { respondToReview } from '../../services/feedbackService'
import type { Review } from '../../types/feedback.types'
import ReviewReplyCard from './ReviewReplyCard'

vi.mock('../../services/feedbackService', () => ({ respondToReview: vi.fn() }))

const review: Review = {
  id: 'review-1',
  rating: 3,
  comment: 'A little cold when I picked it up',
  createdAt: '2026-09-20T02:00:00.000Z',
  customerName: 'Chris W.',
  meal: { id: 'meal-1', name: 'Enchiladas' },
  chefResponse: null,
  chefRespondedAt: null,
}

afterEach(cleanup)

describe('ReviewReplyCard', () => {
  it('posts a public reply to a review', async () => {
    vi.mocked(respondToReview).mockResolvedValue({
      ...review,
      chefResponse: 'Sorry about that! Next time I will pack it hot.',
      chefRespondedAt: '2026-09-21T02:00:00.000Z',
    })
    render(
      <MemoryRouter>
        <ReviewReplyCard review={review} />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Reply' }))
    fireEvent.change(screen.getByLabelText(/your reply/i), { target: { value: 'Sorry about that! Next time I will pack it hot.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Post reply' }))

    await waitFor(() =>
      expect(vi.mocked(respondToReview)).toHaveBeenCalledWith('review-1', 'Sorry about that! Next time I will pack it hot.'),
    )
    expect(await screen.findByText('Sorry about that! Next time I will pack it hot.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Edit reply' })).toBeTruthy()
  })
})
