import type { ApiSuccess } from '../types/api.types'
import type { AvailabilityInput, KitchenProfileInput, MealInput, OwnKitchen, OwnMeal } from '../types/kitchen.types'
import { api, refreshSession } from './api'

type KitchenResponse = ApiSuccess<{ chefProfile: OwnKitchen }>
type MealResponse = ApiSuccess<{ meal: OwnMeal }>

/** Creates the signed-in user's kitchen. Their account becomes a chef account. */
export async function becomeChef(input: KitchenProfileInput): Promise<OwnKitchen> {
  const { data } = await api.post<KitchenResponse>('/chefs', input)
  // The current access token still says "customer"; get one with the chef role.
  await refreshSession()
  return data.data.chefProfile
}

export async function fetchMyKitchen(): Promise<OwnKitchen> {
  const { data } = await api.get<KitchenResponse>('/chefs/me')
  return data.data.chefProfile
}

export async function updateMyKitchen(
  input: Partial<KitchenProfileInput> & { isAcceptingOrders?: boolean },
): Promise<OwnKitchen> {
  const { data } = await api.put<KitchenResponse>('/chefs/me', input)
  return data.data.chefProfile
}

export async function updateAvailability(input: AvailabilityInput): Promise<OwnKitchen> {
  const { data } = await api.put<KitchenResponse>('/chefs/me/availability', input)
  return data.data.chefProfile
}

export async function fetchMyMeals(): Promise<OwnMeal[]> {
  const { data } = await api.get<ApiSuccess<OwnMeal[]>>('/chefs/me/meals')
  return data.data
}

export async function createMeal(input: MealInput): Promise<OwnMeal> {
  const { data } = await api.post<MealResponse>('/chefs/me/meals', input)
  return data.data.meal
}

export async function updateMeal(id: string, input: Partial<MealInput>): Promise<OwnMeal> {
  const { data } = await api.put<MealResponse>(`/chefs/me/meals/${encodeURIComponent(id)}`, input)
  return data.data.meal
}

export async function deleteMeal(id: string): Promise<void> {
  await api.delete(`/chefs/me/meals/${encodeURIComponent(id)}`)
}

/** Uploads a photo and returns the address to save on the meal. */
export async function uploadMealPhoto(file: File): Promise<string> {
  const form = new FormData()
  form.append('photo', file)
  const { data } = await api.post<ApiSuccess<{ url: string }>>('/uploads/meal-photo', form, { timeout: 60_000 })
  return data.data.url
}
