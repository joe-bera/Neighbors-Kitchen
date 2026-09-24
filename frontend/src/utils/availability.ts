import type { AvailabilityWindow } from '../types/kitchen.types'
import { formatPrice } from './format'

/** Days in the order people read a week: Monday first, Sunday last. (0 = Sunday ... 6 = Saturday) */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SHORT_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const DEFAULT_START = '17:00'
const DEFAULT_END = '20:00'

export interface ScheduleDraftDay {
  dayOfWeek: number
  open: boolean
  startTime: string
  endTime: string
}

const weekPosition = (dayOfWeek: number) => WEEK_ORDER.indexOf(dayOfWeek)

/** "17:00" becomes "5:00 PM". */
export function formatClockTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 === 0 ? 12 : hours % 12
  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`
}

/** Days in week order become "Tue – Sat", "Sat & Sun" or "Mon, Wed, Fri". */
function formatDays(days: number[]): string {
  const runs: number[][] = []
  for (const day of days) {
    const run = runs.at(-1)
    if (run && weekPosition(day) === weekPosition(run[run.length - 1]) + 1) {
      run.push(day)
    } else {
      runs.push([day])
    }
  }
  return runs
    .map((run) => {
      const first = SHORT_DAY_NAMES[run[0]]
      const last = SHORT_DAY_NAMES[run[run.length - 1]]
      if (run.length === 1) return first
      return run.length === 2 ? `${first} & ${last}` : `${first} – ${last}`
    })
    .join(', ')
}

/** One readable line per set of hours, e.g. "Tue – Sat: 5:00 PM – 8:00 PM". */
export function summarizeAvailability(windows: AvailabilityWindow[]): string[] {
  const inWeekOrder = [...windows].sort((a, b) => weekPosition(a.dayOfWeek) - weekPosition(b.dayOfWeek))
  const daysByHours = new Map<string, number[]>()
  for (const window of inWeekOrder) {
    const hours = `${window.startTime}|${window.endTime}`
    daysByHours.set(hours, [...(daysByHours.get(hours) ?? []), window.dayOfWeek])
  }
  return [...daysByHours].map(([hours, days]) => {
    const [start, end] = hours.split('|')
    return `${formatDays(days)}: ${formatClockTime(start)} – ${formatClockTime(end)}`
  })
}

/** 24 becomes "1 day", 36 becomes "36 hours". */
export function formatLeadTime(hours: number): string {
  if (hours % 24 === 0) {
    const days = hours / 24
    return `${days} day${days === 1 ? '' : 's'}`
  }
  return `${hours} hour${hours === 1 ? '' : 's'}`
}

/** All seven days for the weekly editor, Monday first; closed days get suggested hours. */
export function toScheduleDraft(windows: AvailabilityWindow[]): ScheduleDraftDay[] {
  return WEEK_ORDER.map((dayOfWeek) => {
    const window = windows.find((candidate) => candidate.dayOfWeek === dayOfWeek)
    return window
      ? { dayOfWeek, open: true, startTime: window.startTime, endTime: window.endTime }
      : { dayOfWeek, open: false, startTime: DEFAULT_START, endTime: DEFAULT_END }
  })
}

export function fromScheduleDraft(draft: ScheduleDraftDay[]): AvailabilityWindow[] {
  return draft.filter((day) => day.open).map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime }))
}

/** How customers get their food, e.g. "Pickup or delivery ($4.99 delivery fee)". */
export function describeHandover(options: { offersPickup: boolean; offersDelivery: boolean; deliveryFee: number }): string {
  const fee = options.deliveryFee > 0 ? `${formatPrice(options.deliveryFee)} delivery fee` : 'free delivery'
  if (options.offersPickup && options.offersDelivery) return `Pickup or delivery (${fee})`
  if (options.offersDelivery) return `Delivery only (${fee})`
  return 'Pickup only'
}
