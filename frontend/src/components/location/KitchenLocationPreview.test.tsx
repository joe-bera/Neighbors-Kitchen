// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import KitchenLocationPreview from './KitchenLocationPreview'

// Leaflet needs a real browser; a stand-in shows where the map would be.
vi.mock('./AreaMap', () => ({ default: () => <div data-testid="area-map" /> }))

const area = { latitude: 34.050606, longitude: -117.194044, radiusMiles: 0.5 }

afterEach(cleanup)

describe('KitchenLocationPreview', () => {
  it('shows the circle neighbors see when the street address was found', async () => {
    render(<KitchenLocationPreview area={area} precision="ADDRESS" zipCode="92373" />)

    expect(await screen.findByTestId('area-map')).toBeTruthy()
    expect(screen.getByText(/Your home is inside it but not at the center/)).toBeTruthy()
  })

  it('says when only the ZIP code was found, without a misleading circle', () => {
    render(<KitchenLocationPreview area={area} precision="ZIP_CODE" zipCode="92373" />)

    expect(screen.getByText(/We could only find your ZIP code/).textContent).toContain('ZIP code 92373')
    expect(screen.queryByTestId('area-map')).toBeNull()
    expect(screen.queryByText(/Your home is inside it/)).toBeNull()
  })

  it('treats a kitchen placed before this was recorded like a ZIP-only one', () => {
    render(<KitchenLocationPreview area={area} precision={null} zipCode="92373" />)

    expect(screen.getByText(/We could only find your ZIP code/)).toBeTruthy()
  })

  it('explains when the kitchen is not on the map at all', () => {
    render(<KitchenLocationPreview area={null} precision={null} zipCode="00000" />)

    expect(screen.getByText(/We could not place your address on the map yet/)).toBeTruthy()
  })
})
