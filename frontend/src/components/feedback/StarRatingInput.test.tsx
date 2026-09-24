// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StarRatingInput from './StarRatingInput'

afterEach(cleanup)

describe('StarRatingInput', () => {
  it('picks a rating when a star is clicked', () => {
    const onChange = vi.fn()
    render(<StarRatingInput name="rating" legend="Your rating" value={null} onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: '4 stars' }))

    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('says what the chosen rating means', () => {
    render(<StarRatingInput name="rating" legend="Your rating" value={5} onChange={() => {}} />)

    expect((screen.getByRole('radio', { name: '5 stars' }) as HTMLInputElement).checked).toBe(true)
    expect(screen.getByText('Excellent')).toBeTruthy()
  })
})
