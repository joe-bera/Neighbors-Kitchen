export type MealCategory = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'DESSERT' | 'SNACK'

export type MealSort = 'recommended' | 'price_asc' | 'price_desc' | 'newest'

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface Paginated<T> {
  items: T[]
  pagination: Pagination
}

/** The small chef summary shown on meal cards. */
export interface ChefSummary {
  id: string
  kitchenName: string | null
  chefName: string
  city: string
  state: string
  isAcceptingOrders: boolean
}

export interface MealCardData {
  id: string
  name: string
  description: string
  price: number
  imageUrl: string | null
  category: MealCategory
  cuisineType: string | null
  dietaryTags: string[]
  servings: number
  prepTimeMinutes: number
  averageRating: number | null
  totalReviews: number
}

export interface MealWithChef extends MealCardData {
  chef: ChefSummary
}

export interface MealDetail extends MealWithChef {
  maxOrdersPerDay: number | null
  menu: { id: string; name: string }
  moreFromChef: MealCardData[]
}

export interface ChefCardData {
  id: string
  kitchenName: string | null
  chefName: string
  firstName: string
  profilePhotoUrl: string | null
  bio: string | null
  city: string
  state: string
  specialties: string[]
  yearsExperience: number | null
  averageRating: number | null
  totalReviews: number
  isAcceptingOrders: boolean
  mealCount: number
  coverImageUrl: string | null
}

export interface ChefMenu {
  id: string
  name: string
  description: string | null
  meals: MealCardData[]
}

export interface ChefDetail extends ChefCardData {
  certifications: string[]
  serviceRadiusMiles: number
  memberSince: string
  menus: ChefMenu[]
  availability: { dayOfWeek: number; startTime: string; endTime: string }[]
  orderLeadTimeHours: number
  offersPickup: boolean
  offersDelivery: boolean
  deliveryFee: number
}

export interface CatalogFilters {
  categories: MealCategory[]
  cuisines: string[]
  dietaryTags: string[]
  cities: string[]
}
