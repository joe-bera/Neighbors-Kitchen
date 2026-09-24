import { describe, expect, it } from 'vitest'
import {
  describeHandover,
  formatClockTime,
  formatLeadTime,
  fromScheduleDraft,
  summarizeAvailability,
  toScheduleDraft,
} from './availability'

const window = (dayOfWeek: number, startTime = '17:00', endTime = '20:00') => ({ dayOfWeek, startTime, endTime })

describe('formatClockTime', () => {
  it.each([
    ['17:00', '5:00 PM'],
    ['08:30', '8:30 AM'],
    ['12:00', '12:00 PM'],
    ['00:15', '12:15 AM'],
  ])('shows %s as %s', (time, expected) => {
    expect(formatClockTime(time)).toBe(expected)
  })
})

describe('summarizeAvailability', () => {
  it('joins a run of days with the same hours', () => {
    expect(summarizeAvailability([2, 3, 4, 5, 6].map((day) => window(day)))).toEqual(['Tue – Sat: 5:00 PM – 8:00 PM'])
  })

  it('treats Sunday as the end of the week', () => {
    expect(summarizeAvailability([0, 3, 4, 5, 6].map((day) => window(day, '16:30', '19:30')))).toEqual([
      'Wed – Sun: 4:30 PM – 7:30 PM',
    ])
  })

  it('writes two days in a row with "&"', () => {
    expect(summarizeAvailability([window(6, '12:00', '18:00'), window(0, '12:00', '18:00')])).toEqual([
      'Sat & Sun: 12:00 PM – 6:00 PM',
    ])
  })

  it('lists separate days with the same hours on one line', () => {
    expect(summarizeAvailability([window(5), window(1), window(3)])).toEqual(['Mon, Wed, Fri: 5:00 PM – 8:00 PM'])
  })

  it('gives each set of hours its own line, starting from Monday', () => {
    expect(summarizeAvailability([window(2, '17:00', '20:00'), window(1, '10:00', '12:00')])).toEqual([
      'Mon: 10:00 AM – 12:00 PM',
      'Tue: 5:00 PM – 8:00 PM',
    ])
  })

  it('returns nothing when no hours are set', () => {
    expect(summarizeAvailability([])).toEqual([])
  })
})

describe('formatLeadTime', () => {
  it.each([
    [12, '12 hours'],
    [24, '1 day'],
    [36, '36 hours'],
    [48, '2 days'],
    [1, '1 hour'],
  ])('shows %s hours as "%s"', (hours, expected) => {
    expect(formatLeadTime(hours)).toBe(expected)
  })
})

describe('schedule drafts for the weekly editor', () => {
  it('lists all seven days from Monday, marking the open ones', () => {
    const draft = toScheduleDraft([window(2, '16:00', '19:00')])

    expect(draft.map((day) => day.dayOfWeek)).toEqual([1, 2, 3, 4, 5, 6, 0])
    expect(draft[1]).toEqual({ dayOfWeek: 2, open: true, startTime: '16:00', endTime: '19:00' })
    expect(draft[0]).toMatchObject({ dayOfWeek: 1, open: false })
  })

  it('turns the open days back into weekly hours', () => {
    const draft = toScheduleDraft([window(2), window(0, '10:00', '14:00')])

    expect(fromScheduleDraft(draft)).toEqual([window(2), window(0, '10:00', '14:00')])
  })
})

describe('describeHandover', () => {
  it.each([
    [{ offersPickup: true, offersDelivery: true, deliveryFee: 4.99 }, 'Pickup or delivery ($4.99 delivery fee)'],
    [{ offersPickup: true, offersDelivery: false, deliveryFee: 0 }, 'Pickup only'],
    [{ offersPickup: false, offersDelivery: true, deliveryFee: 0 }, 'Delivery only (free delivery)'],
  ])('describes %o as "%s"', (options, expected) => {
    expect(describeHandover(options)).toBe(expected)
  })
})
