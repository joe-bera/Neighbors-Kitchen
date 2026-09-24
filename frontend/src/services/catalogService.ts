import type { ApiSuccess } from '../types/api.types'
import type {
  CatalogFilters,
  ChefCardData,
  ChefDetail,
  MealDetail,
  MealWithChef,
  Paginated,
  Pagination,
} from '../types/catalog.types'
import { api } from './api'

type ListResponse<T> = ApiSuccess<T[]> & { pagination: Pagination }

export async function fetchChefs(params: URLSearchParams): Promise<Paginated<ChefCardData>> {
  const { data } = await api.get<ListResponse<ChefCardData>>('/chefs', { params })
  return { items: data.data, pagination: data.pagination }
}

export async function fetchChef(id: string): Promise<ChefDetail> {
  const { data } = await api.get<ApiSuccess<{ chef: ChefDetail }>>(`/chefs/${encodeURIComponent(id)}`)
  return data.data.chef
}

export async function fetchMeals(params: URLSearchParams): Promise<Paginated<MealWithChef>> {
  const { data } = await api.get<ListResponse<MealWithChef>>('/meals', { params })
  return { items: data.data, pagination: data.pagination }
}

export async function fetchMeal(id: string): Promise<MealDetail> {
  const { data } = await api.get<ApiSuccess<{ meal: MealDetail }>>(`/meals/${encodeURIComponent(id)}`)
  return data.data.meal
}

export async function fetchMealFilters(): Promise<CatalogFilters> {
  const { data } = await api.get<ApiSuccess<CatalogFilters>>('/meals/filters')
  return data.data
}
