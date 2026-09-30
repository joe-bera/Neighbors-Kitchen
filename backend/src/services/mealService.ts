import { MealCategory, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';
import { MealListQuery, mealSortOptions } from '../validators/catalogSchemas.js';
import {
  chefSummarySelect,
  containsText,
  mealCardSelect,
  orderableMealWhere,
  paginationMeta,
  recommendedOrder,
  toChefSummary,
  toMealCard,
} from './catalogShared.js';

const mealWithChefSelect = {
  ...mealCardSelect,
  chef: { select: chefSummarySelect },
} satisfies Prisma.MealSelect;

type MealWithChefRow = Prisma.MealGetPayload<{ select: typeof mealWithChefSelect }>;

function toMealWithChef({ chef, ...meal }: MealWithChefRow) {
  return { ...toMealCard(meal), chef: toChefSummary(chef) };
}

const sortOrders: Record<(typeof mealSortOptions)[number], Prisma.MealOrderByWithRelationInput[]> = {
  recommended: recommendedOrder,
  price_asc: [{ price: 'asc' }, { createdAt: 'asc' }],
  price_desc: [{ price: 'desc' }, { createdAt: 'asc' }],
  newest: [{ createdAt: 'desc' }],
};

/** Matches the meal's name, description, cuisine or a dietary tag, or the chef's kitchen name or city. */
function mealSearchWhere(term: string): Prisma.MealWhereInput {
  const text = containsText(term);
  return {
    OR: [
      { name: text },
      { description: text },
      { cuisineType: text },
      { dietaryTags: { has: term.toLowerCase() } },
      { chef: { kitchenName: text } },
      { chef: { city: text } },
    ],
  };
}

export async function listMeals(query: MealListQuery) {
  const { search, category, cuisine, dietary, maxPrice, chefId, sort, page, limit } = query;
  const filters: Prisma.MealWhereInput[] = [orderableMealWhere];
  if (search) filters.push(mealSearchWhere(search));
  if (category) filters.push({ category });
  if (cuisine) filters.push({ cuisineType: { equals: cuisine, mode: 'insensitive' } });
  if (dietary.length > 0) filters.push({ dietaryTags: { hasEvery: dietary } });
  if (maxPrice !== undefined) filters.push({ price: { lte: maxPrice } });
  if (chefId) filters.push({ chefId });
  const where: Prisma.MealWhereInput = { AND: filters };

  const [total, meals] = await prisma.$transaction([
    prisma.meal.count({ where }),
    prisma.meal.findMany({
      where,
      select: mealWithChefSelect,
      orderBy: sortOrders[sort],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { meals: meals.map(toMealWithChef), pagination: paginationMeta(page, limit, total) };
}

export async function getMeal(id: string) {
  const meal = await prisma.meal.findFirst({
    where: { id, ...orderableMealWhere },
    select: {
      ...mealWithChefSelect,
      chefId: true,
      maxOrdersPerDay: true,
      menu: { select: { id: true, name: true } },
    },
  });
  if (!meal) throw new AppError(404, 'NOT_FOUND', 'We could not find that meal');

  const moreFromChef = await prisma.meal.findMany({
    where: { ...orderableMealWhere, chefId: meal.chefId, id: { not: meal.id } },
    select: mealCardSelect,
    orderBy: recommendedOrder,
    take: 4,
  });

  const { chefId: _chefId, maxOrdersPerDay, menu, ...card } = meal;
  return {
    ...toMealWithChef(card),
    maxOrdersPerDay,
    menu,
    moreFromChef: moreFromChef.map(toMealCard),
  };
}

/** The options the browse filters can offer, based on meals that can be ordered right now. */
export async function getMealFilters() {
  const meals = await prisma.meal.findMany({
    where: orderableMealWhere,
    select: { cuisineType: true, dietaryTags: true, chef: { select: { city: true } } },
  });
  const sortedUnique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));

  return {
    categories: Object.values(MealCategory),
    cuisines: sortedUnique(meals.flatMap((meal) => (meal.cuisineType ? [meal.cuisineType] : []))),
    dietaryTags: sortedUnique(meals.flatMap((meal) => meal.dietaryTags)),
    cities: sortedUnique(meals.map((meal) => meal.chef.city)),
  };
}
