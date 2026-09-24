// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSuggestion, fetchChefSuggestions, removeSuggestionVote, voteForSuggestion } from '../../services/feedbackService'
import { useAuthStore } from '../../store/authStore'
import type { Suggestion } from '../../types/feedback.types'
import DishRequests from './DishRequests'

vi.mock('../../services/feedbackService', () => ({
  fetchChefSuggestions: vi.fn(),
  createSuggestion: vi.fn(),
  voteForSuggestion: vi.fn(),
  removeSuggestionVote: vi.fn(),
}))

function suggestion(overrides: Partial<Suggestion> = {}): Suggestion {
  return {
    id: 'suggestion-1',
    mealName: 'Birria tacos',
    description: 'Slow-cooked beef birria with consommé for dipping.',
    dietaryRequirements: ['dairy-free'],
    status: 'PENDING',
    votes: 2,
    chefResponse: null,
    suggestedBy: 'Sam R.',
    createdAt: '2026-09-20T02:00:00.000Z',
    hasVoted: false,
    ...overrides,
  }
}

function signIn() {
  useAuthStore.setState({
    status: 'authenticated',
    accessToken: 'token',
    user: {
      id: 'user-1',
      email: 'chris@example.com',
      role: 'CUSTOMER',
      firstName: 'Chris',
      lastName: 'Walker',
      phone: null,
      profilePhotoUrl: null,
      emailVerified: false,
      createdAt: '2026-09-01T00:00:00.000Z',
    },
  })
}

function renderRequests(isOwnKitchen = false) {
  return render(
    <MemoryRouter initialEntries={['/chefs/chef-1']}>
      <DishRequests chefId="chef-1" kitchenName="Abuela's Table" isOwnKitchen={isOwnKitchen} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.mocked(fetchChefSuggestions).mockReset()
  vi.mocked(createSuggestion).mockReset()
  vi.mocked(voteForSuggestion).mockReset()
  vi.mocked(removeSuggestionVote).mockReset()
  useAuthStore.setState({ status: 'anonymous', accessToken: null, user: null })
})
afterEach(cleanup)

describe('DishRequests', () => {
  it('lets a signed-in neighbor vote for a dish and take the vote back', async () => {
    signIn()
    vi.mocked(fetchChefSuggestions).mockResolvedValue([suggestion()])
    vi.mocked(voteForSuggestion).mockResolvedValue(suggestion({ votes: 3, hasVoted: true }))
    vi.mocked(removeSuggestionVote).mockResolvedValue(suggestion({ votes: 2, hasVoted: false }))
    renderRequests()

    fireEvent.click(await screen.findByRole('button', { name: 'I want this too', pressed: false }))

    expect(await screen.findByText('3 neighbors want this')).toBeTruthy()
    expect(vi.mocked(voteForSuggestion)).toHaveBeenCalledWith('suggestion-1')

    fireEvent.click(screen.getByRole('button', { name: 'I want this too', pressed: true }))

    await waitFor(() => expect(vi.mocked(removeSuggestionVote)).toHaveBeenCalledWith('suggestion-1'))
    expect(await screen.findByText('2 neighbors want this')).toBeTruthy()
  })

  it('asks visitors to log in before voting or requesting a dish', async () => {
    vi.mocked(fetchChefSuggestions).mockResolvedValue([suggestion()])
    renderRequests()

    expect(await screen.findByText('Birria tacos')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'I want this too' })).toBeNull()
    expect(screen.getByRole('link', { name: /log in/i }).getAttribute('href')).toBe('/login?redirect=%2Fchefs%2Fchef-1')
  })

  it('checks a dish request before sending it, then shows it on the list', async () => {
    signIn()
    vi.mocked(fetchChefSuggestions).mockResolvedValue([])
    vi.mocked(createSuggestion).mockResolvedValue(
      suggestion({ id: 'suggestion-2', mealName: 'Pozole rojo', votes: 1, hasVoted: true, dietaryRequirements: ['gluten-free'] }),
    )
    renderRequests()

    fireEvent.click(await screen.findByRole('button', { name: 'Request a dish' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))

    expect(await screen.findByText('Name the dish you would like')).toBeTruthy()
    expect(vi.mocked(createSuggestion)).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Dish name'), { target: { value: 'Pozole rojo' } })
    fireEvent.change(screen.getByLabelText(/tell the chef/i), { target: { value: 'Pork and hominy stew with red chile' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Gluten-free' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))

    await waitFor(() =>
      expect(vi.mocked(createSuggestion)).toHaveBeenCalledWith('chef-1', {
        mealName: 'Pozole rojo',
        description: 'Pork and hominy stew with red chile',
        dietaryRequirements: ['gluten-free'],
      }),
    )
    expect(await screen.findByText('Pozole rojo')).toBeTruthy()
  })

  it("points chefs to their dashboard instead of voting on their own kitchen's requests", async () => {
    signIn()
    vi.mocked(fetchChefSuggestions).mockResolvedValue([suggestion()])
    renderRequests(true)

    expect(await screen.findByText('Birria tacos')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'I want this too' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Request a dish' })).toBeNull()
    expect(screen.getByRole('link', { name: /dashboard/i }).getAttribute('href')).toBe('/chef/feedback?view=requests')
  })
})
