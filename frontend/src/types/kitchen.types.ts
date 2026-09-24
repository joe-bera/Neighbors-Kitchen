import type { ChefArea, MealCardData, MealCategory } from './catalog.types'

/** Weekly hours, in the chef's local time. dayOfWeek: 0 = Sunday ... 6 = Saturday. */
export interface AvailabilityWindow {
  dayOfWeek: number
  startTime: string
  endTime: string
}

/** A chef's own view of their kitchen, including private details. */
export interface OwnKitchen {
  id: string
  kitchenName: string | null
  bio: string | null
  specialties: string[]
  yearsExperience: number | null
  certifications: string[]
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string
  zipCode: string
  /** The approximate area neighbors see, or null if the address could not be placed on the map. */
  area: ChefArea | null
  serviceRadiusMiles: number
  isAcceptingOrders: boolean
  orderLeadTimeHours: number
  offersPickup: boolean
  offersDelivery: boolean
  deliveryFee: number
  timezone: string
  availability: AvailabilityWindow[]
  averageRating: number | null
  totalReviews: number
  totalOrders: number
  mealCount: number
  createdAt: string
}

export interface OwnMeal extends MealCardData {
  isAvailable: boolean
  maxOrdersPerDay: number | null
  totalOrders: number
  createdAt: string
  updatedAt: string
}

export interface KitchenProfileInput {
  kitchenName: string
  bio: string
  specialties: string[]
  yearsExperience: number | null
  certifications: string[]
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string
  zipCode: string
  serviceRadiusMiles: number
}

export interface MealInput {
  name: string
  description: string
  price: number
  category: MealCategory
  cuisineType: string | null
  dietaryTags: string[]
  servings: number
  prepTimeMinutes: number
  maxOrdersPerDay: number | null
  isAvailable: boolean
  imageUrl: string | null
}

export interface AvailabilityInput {
  schedule: AvailabilityWindow[]
  orderLeadTimeHours: number
  offersPickup: boolean
  offersDelivery: boolean
  deliveryFee: number
}
