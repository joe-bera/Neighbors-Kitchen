import type { ApiSuccess } from '../types/api.types'
import type { Paginated, Pagination } from '../types/catalog.types'
import type {
  CreateReviewInput,
  Review,
  Suggestion,
  SuggestionInput,
  SuggestionUpdateInput,
} from '../types/feedback.types'
import { api } from './api'

type ListResponse<T> = ApiSuccess<T[]> & { pagination: Pagination }

const path = (id: string) => encodeURIComponent(id)

// Reviews

export async function fetchChefReviews(chefId: string, page: number, limit: number): Promise<Paginated<Review>> {
  const { data } = await api.get<ListResponse<Review>>(`/chefs/${path(chefId)}/reviews`, { params: { page, limit } })
  return { items: data.data, pagination: data.pagination }
}

export async function fetchMealReviews(mealId: string, page: number, limit: number): Promise<Paginated<Review>> {
  const { data } = await api.get<ListResponse<Review>>(`/meals/${path(mealId)}/reviews`, { params: { page, limit } })
  return { items: data.data, pagination: data.pagination }
}

export async function createReview(input: CreateReviewInput): Promise<Review> {
  const { data } = await api.post<ApiSuccess<{ review: Review }>>('/reviews', input)
  return data.data.review
}

export async function reportReview(id: string, reason: string | null): Promise<void> {
  await api.post(`/reviews/${path(id)}/report`, { reason })
}

export async function fetchMyKitchenReviews(page: number, limit: number): Promise<Paginated<Review>> {
  const { data } = await api.get<ListResponse<Review>>('/chefs/me/reviews', { params: { page, limit } })
  return { items: data.data, pagination: data.pagination }
}

export async function respondToReview(id: string, response: string): Promise<Review> {
  const { data } = await api.post<ApiSuccess<{ review: Review }>>(`/chefs/me/reviews/${path(id)}/response`, { response })
  return data.data.review
}

// Dish requests

export async function fetchChefSuggestions(chefId: string): Promise<Suggestion[]> {
  const { data } = await api.get<ApiSuccess<Suggestion[]>>(`/chefs/${path(chefId)}/suggestions`)
  return data.data
}

export async function createSuggestion(chefId: string, input: SuggestionInput): Promise<Suggestion> {
  const { data } = await api.post<ApiSuccess<{ suggestion: Suggestion }>>(`/chefs/${path(chefId)}/suggestions`, input)
  return data.data.suggestion
}

export async function voteForSuggestion(id: string): Promise<Suggestion> {
  const { data } = await api.post<ApiSuccess<{ suggestion: Suggestion }>>(`/suggestions/${path(id)}/vote`)
  return data.data.suggestion
}

export async function removeSuggestionVote(id: string): Promise<Suggestion> {
  const { data } = await api.delete<ApiSuccess<{ suggestion: Suggestion }>>(`/suggestions/${path(id)}/vote`)
  return data.data.suggestion
}

export async function fetchMyKitchenSuggestions(): Promise<Suggestion[]> {
  const { data } = await api.get<ApiSuccess<Suggestion[]>>('/chefs/me/suggestions')
  return data.data
}

export async function updateSuggestion(id: string, input: SuggestionUpdateInput): Promise<Suggestion> {
  const { data } = await api.put<ApiSuccess<{ suggestion: Suggestion }>>(`/chefs/me/suggestions/${path(id)}`, input)
  return data.data.suggestion
}
