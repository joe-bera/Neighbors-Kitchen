/** A customer's review of one meal, as shown on chef and meal pages. */
export interface Review {
  id: string
  rating: number
  comment: string | null
  createdAt: string
  /** e.g. "Chris W." */
  customerName: string
  meal: { id: string; name: string }
  chefResponse: string | null
  chefRespondedAt: string | null
}

/** A review as shown on the order it belongs to. */
export interface OrderReview {
  mealId: string
  rating: number
  comment: string | null
  createdAt: string
  chefResponse: string | null
}

export interface CreateReviewInput {
  orderId: string
  mealId: string
  rating: number
  comment: string | null
}

export type SuggestionStatus = 'PENDING' | 'CONSIDERING' | 'ACCEPTED' | 'DECLINED'

/** A dish a customer asked a chef to cook. Neighbors vote for the ones they want too. */
export interface Suggestion {
  id: string
  mealName: string
  description: string
  dietaryRequirements: string[]
  status: SuggestionStatus
  votes: number
  chefResponse: string | null
  suggestedBy: string
  createdAt: string
  /** Whether the signed-in viewer has voted for it. */
  hasVoted: boolean
}

export interface SuggestionInput {
  mealName: string
  description: string
  dietaryRequirements: string[]
}

export interface SuggestionUpdateInput {
  status: SuggestionStatus
  chefResponse: string | null
}
