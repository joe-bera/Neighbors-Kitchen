import { describe, expect, it } from 'vitest'
import { formatPrepTime, formatPrice } from './format'

describe('formatPrice', () => {
  it.each([
    [14, '$14.00'],
    [7.5, '$7.50'],
    [1234.5, '$1,234.50'],
  ])('shows %s as %s', (amount, expected) => {
    expect(formatPrice(amount)).toBe(expected)
  })
})

describe('formatPrepTime', () => {
  it.each([
    [45, '45 min'],
    [60, '1 hr'],
    [90, '1 hr 30 min'],
    [150, '2 hr 30 min'],
  ])('shows %s minutes as %s', (minutes, expected) => {
    expect(formatPrepTime(minutes)).toBe(expected)
  })
})
