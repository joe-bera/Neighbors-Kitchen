import { describe, expect, it } from 'vitest'
import { timeAgo } from './timeAgo'

const now = new Date('2026-09-29T20:00:00.000Z')

describe('timeAgo', () => {
  it.each([
    ['2026-09-29T19:59:30.000Z', 'Just now'],
    ['2026-09-29T20:00:05.000Z', 'Just now'],
    ['2026-09-29T19:55:00.000Z', '5 min ago'],
    ['2026-09-29T19:00:00.000Z', '1 hr ago'],
    ['2026-09-29T08:00:00.000Z', '12 hr ago'],
    ['2026-09-28T20:00:00.000Z', '1 day ago'],
    ['2026-09-24T20:00:00.000Z', '5 days ago'],
    ['2026-09-10T12:00:00.000Z', 'Sep 10'],
  ])('%s is "%s"', (iso, expected) => {
    expect(timeAgo(iso, now)).toBe(expected)
  })
})
