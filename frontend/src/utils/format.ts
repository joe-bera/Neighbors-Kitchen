import type { MealCategory } from '../types/catalog.types'

const priceFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function formatPrice(amount: number): string {
  return priceFormatter.format(amount)
}

export function formatPrepTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (hours === 0) return `${remainder} min`
  return remainder === 0 ? `${hours} hr` : `${hours} hr ${remainder} min`
}

const CATEGORY_LABELS: Record<MealCategory, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
  DESSERT: 'Dessert',
  SNACK: 'Snack',
}

export function formatCategory(category: MealCategory): string {
  return CATEGORY_LABELS[category]
}

const DIETARY_LABELS: Record<string, string> = {
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  'gluten-free': 'Gluten-free',
  'dairy-free': 'Dairy-free',
  'nut-free': 'Nut-free',
  'contains-nuts': 'Contains nuts',
  halal: 'Halal',
  kosher: 'Kosher',
  spicy: 'Spicy',
}

/** The kitchen's name, or "Maria's Kitchen" when the chef has not named it. */
export function kitchenTitle(chef: { kitchenName: string | null; firstName: string }): string {
  return chef.kitchenName ?? `${chef.firstName}'s Kitchen`
}

export function formatDietaryTag(tag: string): string {
  return DIETARY_LABELS[tag] ?? tag.charAt(0).toUpperCase() + tag.slice(1).replace(/-/g, ' ')
}
