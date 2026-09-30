/** The delivery distances a chef picks from, in miles. */
export const RADIUS_OPTIONS = [2, 5, 10, 15, 25]

/** The menu's choices, including the kitchen's current distance when it is not one of them (e.g. 8 miles). */
export function radiusOptions(current?: number): number[] {
  if (current === undefined || RADIUS_OPTIONS.includes(current)) return RADIUS_OPTIONS
  return [...RADIUS_OPTIONS, current].sort((a, b) => a - b)
}
