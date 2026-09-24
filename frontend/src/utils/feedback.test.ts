import { describe, expect, it } from 'vitest'
import { formatReviewDate, ratingWord, suggestionStatusLabel, votesLabel } from './feedback'

describe('ratingWord', () => {
  it.each([
    [1, 'Poor'],
    [2, 'Fair'],
    [3, 'Good'],
    [4, 'Very good'],
    [5, 'Excellent'],
  ])('describes %i stars as "%s"', (stars, expected) => {
    expect(ratingWord(stars)).toBe(expected)
  })
})

describe('suggestionStatusLabel', () => {
  it.each([
    ['PENDING', 'Waiting for the chef'],
    ['CONSIDERING', 'Chef is considering it'],
    ['ACCEPTED', 'Coming soon'],
    ['DECLINED', 'Not planned'],
  ] as const)('calls %s requests "%s"', (status, expected) => {
    expect(suggestionStatusLabel(status)).toBe(expected)
  })
})

describe('votesLabel', () => {
  it('counts one neighbor', () => {
    expect(votesLabel(1)).toBe('1 neighbor wants this')
  })

  it('counts several neighbors', () => {
    expect(votesLabel(3)).toBe('3 neighbors want this')
  })
})

describe('formatReviewDate', () => {
  it('shows the day a review was written', () => {
    expect(formatReviewDate('2026-09-24T04:30:00.000Z', 'America/Los_Angeles')).toBe('Sep 23, 2026')
  })
})
