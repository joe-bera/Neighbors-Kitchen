// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NearMeForm from './NearMeForm'

const getCurrentPosition = vi.fn()

beforeEach(() => {
  getCurrentPosition.mockReset()
  Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true })
})

afterEach(cleanup)

function renderForm() {
  const onChoose = vi.fn()
  render(<NearMeForm onChoose={onChoose} initialZip="" />)
  return onChoose
}

describe('NearMeForm', () => {
  it('searches from a ZIP code, accepting ZIP+4', () => {
    const onChoose = renderForm()

    fireEvent.change(screen.getByLabelText('ZIP code'), { target: { value: '92373-1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'Find chefs' }))

    expect(onChoose).toHaveBeenCalledWith({ kind: 'zip', zip: '92373' })
  })

  it('asks for a 5-digit ZIP code', () => {
    const onChoose = renderForm()

    fireEvent.change(screen.getByLabelText('ZIP code'), { target: { value: '923' } })
    fireEvent.click(screen.getByRole('button', { name: 'Find chefs' }))

    expect(screen.getByRole('alert').textContent).toBe('Enter a 5-digit ZIP code')
    expect(onChoose).not.toHaveBeenCalled()
  })

  it("uses the browser's location, rounded to about half a mile", () => {
    getCurrentPosition.mockImplementation((found: PositionCallback) =>
      found({ coords: { latitude: 34.055216, longitude: -117.182488 } } as GeolocationPosition),
    )
    const onChoose = renderForm()

    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }))

    expect(onChoose).toHaveBeenCalledWith({ kind: 'here', latitude: 34.06, longitude: -117.18 })
  })

  it('asks for a ZIP code when the location is not available', () => {
    getCurrentPosition.mockImplementation((_found: PositionCallback, failed: PositionErrorCallback) =>
      failed({ code: 1, message: 'User denied Geolocation' } as GeolocationPositionError),
    )
    const onChoose = renderForm()

    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }))

    expect(screen.getByRole('alert').textContent).toBe('We could not get your location. Type your ZIP code instead.')
    expect(onChoose).not.toHaveBeenCalled()
  })
})
