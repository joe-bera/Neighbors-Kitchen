// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { updateSuggestion } from '../../services/feedbackService'
import type { Suggestion } from '../../types/feedback.types'
import RequestCard from './RequestCard'

vi.mock('../../services/feedbackService', () => ({ updateSuggestion: vi.fn() }))

const request: Suggestion = {
  id: 'suggestion-1',
  mealName: 'Birria tacos',
  description: 'Slow-cooked beef birria with consommé for dipping.',
  dietaryRequirements: [],
  status: 'PENDING',
  votes: 4,
  chefResponse: null,
  suggestedBy: 'Sam R.',
  createdAt: '2026-09-20T02:00:00.000Z',
  hasVoted: false,
}

afterEach(cleanup)

describe('RequestCard', () => {
  it("saves the chef's answer to a dish request", async () => {
    vi.mocked(updateSuggestion).mockResolvedValue({ ...request, status: 'ACCEPTED', chefResponse: 'Coming Saturday!' })
    render(<RequestCard suggestion={request} />)

    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'ACCEPTED' } })
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'Coming Saturday!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save answer' }))

    await waitFor(() =>
      expect(vi.mocked(updateSuggestion)).toHaveBeenCalledWith('suggestion-1', { status: 'ACCEPTED', chefResponse: 'Coming Saturday!' }),
    )
    expect(await screen.findByText('Saved')).toBeTruthy()
  })
})
