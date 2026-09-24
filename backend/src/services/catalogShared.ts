import { Prisma } from '@prisma/client';

// Rules for what the public catalog shows, and how records are shaped for it.
// Public responses never include a chef's street address, exact location or contact details.

/** A chef appears publicly only while their account is active. */
export const visibleChefWhere = {
  user: { isActive: true, role: 'CHEF' },
} satisfies Prisma.ChefProfileWhereInput;

/** The meal's own conditions for being orderable (used inside chef queries). */
export const orderableMealOwnWhere = {
  isAvailable: true,
  menu: { isActive: true },
} satisfies Prisma.MealWhereInput;

/** A meal can be ordered when it is available, on an active menu, from a visible chef. */
export const orderableMealWhere = {
  ...orderableMealOwnWhere,
  chef: visibleChefWhere,
} satisfies Prisma.MealWhereInput;

export function containsText(term: string) {
  return { contains: term, mode: 'insensitive' as const };
}

export function titleCase(text: string): string {
  return text.toLowerCase().replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

/** "Maria Delgado" is shown publicly as "Maria D." */
export function chefDisplayName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName.charAt(0)}.`;
}

export const chefSummarySelect = {
  id: true,
  kitchenName: true,
  city: true,
  state: true,
  isAcceptingOrders: true,
  user: { select: { firstName: true, lastName: true } },
} satisfies Prisma.ChefProfileSelect;

type ChefSummaryRow = Prisma.ChefProfileGetPayload<{ select: typeof chefSummarySelect }>;

export function toChefSummary(chef: ChefSummaryRow) {
  return {
    id: chef.id,
    kitchenName: chef.kitchenName,
    chefName: chefDisplayName(chef.user),
    city: chef.city,
    state: chef.state,
    isAcceptingOrders: chef.isAcceptingOrders,
  };
}

export const mealCardSelect = {
  id: true,
  name: true,
  description: true,
  price: true,
  imageUrl: true,
  category: true,
  cuisineType: true,
  dietaryTags: true,
  servings: true,
  prepTimeMinutes: true,
  averageRating: true,
  totalReviews: true,
} satisfies Prisma.MealSelect;

type MealCardRow = Prisma.MealGetPayload<{ select: typeof mealCardSelect }>;

export function toMealCard(meal: MealCardRow) {
  return {
    ...meal,
    price: meal.price.toNumber(),
    averageRating: meal.averageRating?.toNumber() ?? null,
  };
}

/** Best-rated first; unrated items after, in the order they were added. */
export const recommendedOrder = [
  { averageRating: { sort: 'desc', nulls: 'last' } },
  { totalOrders: 'desc' },
  { createdAt: 'asc' },
] satisfies Prisma.MealOrderByWithRelationInput[] & Prisma.ChefProfileOrderByWithRelationInput[];

export function paginationMeta(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
