import type { SuggestionStatus } from '../types/feedback.types'

const RATING_WORDS = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent']

/** What a star rating means, e.g. 4 -> "Very good". */
export function ratingWord(stars: number): string {
  return RATING_WORDS[stars - 1] ?? ''
}

const SUGGESTION_STATUS_LABELS: Record<SuggestionStatus, string> = {
  PENDING: 'Waiting for the chef',
  CONSIDERING: 'Chef is considering it',
  ACCEPTED: 'Coming soon',
  DECLINED: 'Not planned',
}

export function suggestionStatusLabel(status: SuggestionStatus): string {
  return SUGGESTION_STATUS_LABELS[status]
}

export function votesLabel(votes: number): string {
  return votes === 1 ? '1 neighbor wants this' : `${votes} neighbors want this`
}

/** The day a review was written, e.g. "Sep 23, 2026". Uses the viewer's time zone unless one is given. */
export function formatReviewDate(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone }).format(new Date(iso))
}
