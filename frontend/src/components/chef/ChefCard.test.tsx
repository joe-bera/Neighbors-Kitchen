// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import type { ChefCardData } from '../../types/catalog.types'
import ChefCard from './ChefCard'

const maria: ChefCardData = {
  id: 'chef-1',
  kitchenName: "Abuela's Table",
  chefName: 'Maria D.',
  firstName: 'Maria',
  profilePhotoUrl: null,
  bio: null,
  city: 'Redlands',
  state: 'CA',
  specialties: ['Mexican'],
  yearsExperience: 20,
  averageRating: 4.8,
  totalReviews: 4,
  isAcceptingOrders: true,
  mealCount: 4,
  coverImageUrl: null,
  distanceMiles: null,
}

afterEach(cleanup)

function renderCard(chef: ChefCardData) {
  render(
    <MemoryRouter>
      <ChefCard chef={chef} />
    </MemoryRouter>,
  )
}

describe('ChefCard', () => {
  it('shows how far away the chef is when searching near a place', () => {
    renderCard({ ...maria, distanceMiles: 2.1 })

    expect(screen.getByText('2.1 miles away')).toBeTruthy()
  })

  it('shows no distance otherwise', () => {
    renderCard(maria)

    expect(screen.queryByText(/away/)).toBeNull()
  })
})
