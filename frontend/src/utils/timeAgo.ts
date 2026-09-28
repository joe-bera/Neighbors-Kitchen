const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

/** How long ago something happened: "Just now", "5 min ago", "3 hr ago", "2 days ago", or the date after a week. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const elapsed = now.getTime() - new Date(iso).getTime()
  if (elapsed < MINUTE) return 'Just now'
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} hr ago`
  if (elapsed < 7 * DAY) {
    const days = Math.floor(elapsed / DAY)
    return `${days} day${days === 1 ? '' : 's'} ago`
  }
  return dateFormatter.format(new Date(iso))
}
