/**
 * Returns a copy of `current` with `changes` applied, for filter links and forms.
 * Empty values are removed, and any change other than the page itself goes back to page 1.
 */
export function withUpdatedParams(
  current: URLSearchParams,
  changes: Record<string, string | null | undefined>,
): URLSearchParams {
  const next = new URLSearchParams(current)
  if (!('page' in changes)) next.delete('page')

  for (const [name, value] of Object.entries(changes)) {
    const isDefaultPage = name === 'page' && value === '1'
    if (value === null || value === undefined || value === '' || isDefaultPage) {
      next.delete(name)
    } else {
      next.set(name, value)
    }
  }
  return next
}

/** A copy of `current` without the named parameters. */
export function withoutParams(current: URLSearchParams, ...names: string[]): URLSearchParams {
  const next = new URLSearchParams(current)
  for (const name of names) next.delete(name)
  return next
}
