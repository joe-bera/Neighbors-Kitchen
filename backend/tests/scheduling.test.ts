import { describe, expect, it } from 'vitest';
import { isOrderSlot, listOrderSlots } from '../src/services/scheduling.js';

const LA = 'America/Los_Angeles';

// 2026-09-28 is a Monday. In September, Los Angeles is UTC-7.
const mondayMorning = new Date('2026-09-28T17:00:00.000Z'); // Mon 10:00 AM in Los Angeles

const tuesdayEvenings = {
  timezone: LA,
  orderLeadTimeHours: 24,
  availability: [{ dayOfWeek: 2, startTime: '17:00', endTime: '19:00' }],
};

describe('listOrderSlots', () => {
  it("offers half-hour times during the chef's hours, converted to UTC", () => {
    const days = listOrderSlots(tuesdayEvenings, mondayMorning);

    expect(days[0]).toEqual({
      date: '2026-09-29',
      slots: [
        '2026-09-30T00:00:00.000Z', // Tue 5:00 PM in Los Angeles
        '2026-09-30T00:30:00.000Z',
        '2026-09-30T01:00:00.000Z',
        '2026-09-30T01:30:00.000Z', // Tue 6:30 PM, the last start before 7:00 PM
      ],
    });
  });

  it('only looks two weeks ahead', () => {
    const days = listOrderSlots(tuesdayEvenings, mondayMorning);

    expect(days.map((day) => day.date)).toEqual(['2026-09-29', '2026-10-06']);
  });

  it("leaves out times inside the chef's lead time", () => {
    const tuesdayAfternoon = new Date('2026-09-29T23:40:00.000Z'); // Tue 4:40 PM in Los Angeles

    const days = listOrderSlots({ ...tuesdayEvenings, orderLeadTimeHours: 1 }, tuesdayAfternoon);

    expect(days[0]).toEqual({
      date: '2026-09-29',
      slots: ['2026-09-30T01:00:00.000Z', '2026-09-30T01:30:00.000Z'], // 6:00 and 6:30 PM
    });
  });

  it('uses standard time after the clocks change in November', () => {
    const fridayBeforeTheChange = new Date('2026-10-30T19:00:00.000Z');
    const sundayMornings = {
      timezone: LA,
      orderLeadTimeHours: 12,
      availability: [{ dayOfWeek: 0, startTime: '10:00', endTime: '11:00' }],
    };

    const days = listOrderSlots(sundayMornings, fridayBeforeTheChange);

    // Sunday 2026-11-01 is the first day of standard time (UTC-8): 10:00 AM is 18:00 UTC.
    expect(days[0]).toEqual({
      date: '2026-11-01',
      slots: ['2026-11-01T18:00:00.000Z', '2026-11-01T18:30:00.000Z'],
    });
  });

  it('returns nothing when the chef has no hours', () => {
    expect(listOrderSlots({ ...tuesdayEvenings, availability: [] }, mondayMorning)).toEqual([]);
  });
});

describe('isOrderSlot', () => {
  it('accepts an offered time', () => {
    expect(isOrderSlot(tuesdayEvenings, new Date('2026-09-30T00:30:00.000Z'), mondayMorning)).toBe(true);
  });

  it('rejects a time between the half-hour marks', () => {
    expect(isOrderSlot(tuesdayEvenings, new Date('2026-09-30T00:15:00.000Z'), mondayMorning)).toBe(false);
  });

  it("rejects a time inside the chef's lead time", () => {
    const tuesdayNoon = new Date('2026-09-29T19:00:00.000Z');

    expect(isOrderSlot(tuesdayEvenings, new Date('2026-09-30T00:30:00.000Z'), tuesdayNoon)).toBe(false);
  });
});
