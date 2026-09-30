import { DateTime } from 'luxon';

// Pre-order times: every half hour inside a chef's weekly hours, in the chef's own time zone,
// no sooner than their lead time and no more than two weeks ahead.

const SLOT_MINUTES = 30;
const BOOKING_WINDOW_DAYS = 14;

export interface SchedulingChef {
  timezone: string;
  orderLeadTimeHours: number;
  availability: { dayOfWeek: number; startTime: string; endTime: string }[];
}

export interface SlotDay {
  /** The chef's local date, e.g. "2026-09-29". */
  date: string;
  /** Start times as UTC ISO strings. */
  slots: string[];
}

function atClockTime(day: DateTime, time: string): DateTime {
  const [hour, minute] = time.split(':').map(Number);
  return day.set({ hour, minute, second: 0, millisecond: 0 });
}

export function listOrderSlots(chef: SchedulingChef, now: Date = new Date()): SlotDay[] {
  const earliest = DateTime.fromJSDate(now).plus({ hours: chef.orderLeadTimeHours });
  const today = DateTime.fromJSDate(now, { zone: chef.timezone }).startOf('day');
  const days: SlotDay[] = [];

  for (let offset = 0; offset <= BOOKING_WINDOW_DAYS; offset += 1) {
    const day = today.plus({ days: offset });
    const dayOfWeek = day.weekday % 7; // Luxon counts Monday = 1 ... Sunday = 7
    const hours = chef.availability.find((window) => window.dayOfWeek === dayOfWeek);
    if (!hours) continue;

    const slots: string[] = [];
    const closing = atClockTime(day, hours.endTime);
    for (let slot = atClockTime(day, hours.startTime); slot < closing; slot = slot.plus({ minutes: SLOT_MINUTES })) {
      if (slot >= earliest) slots.push(slot.toUTC().toISO()!);
    }
    if (slots.length > 0) days.push({ date: day.toISODate()!, slots });
  }
  return days;
}

export function isOrderSlot(chef: SchedulingChef, time: Date, now: Date = new Date()): boolean {
  const wanted = time.getTime();
  return listOrderSlots(chef, now).some((day) => day.slots.some((slot) => new Date(slot).getTime() === wanted));
}

/** The start and end (UTC) of the chef's local day containing `time`, for per-day limits. */
export function localDayBounds(timezone: string, time: Date): { start: Date; end: Date } {
  const start = DateTime.fromJSDate(time, { zone: timezone }).startOf('day');
  return { start: start.toJSDate(), end: start.plus({ days: 1 }).toJSDate() };
}
