import { DateTime } from 'luxon';

// Wording shared by the bell and email text. Times are shown in the chef's time zone, like the rest of the app.

/** E.g. "Tue, Sep 29 at 6:00 PM". */
export function formatWhen(iso: string, timezone: string): string {
  return DateTime.fromISO(iso, { zone: timezone, locale: 'en-US' }).toFormat("ccc, LLL d 'at' h:mm a");
}

const moneyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** E.g. "$29.70". */
export function formatMoney(amount: number): string {
  return moneyFormatter.format(amount);
}

/** E.g. "2 × Tamales, 1 × Churros". */
export function formatItems(items: { name: string; quantity: number }[]): string {
  return items.map((item) => `${item.quantity} × ${item.name}`).join(', ');
}

/** Text shortened to at most `max` characters, ending in "…" when something was cut. */
export function excerpt(text: string, max = 120): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

/** What a dish request's status is called on the website. */
export const REQUEST_STATUS_WORDS = {
  PENDING: 'Waiting for the chef',
  CONSIDERING: 'Chef is considering it',
  ACCEPTED: 'Coming soon',
  DECLINED: 'Not planned',
} as const;
