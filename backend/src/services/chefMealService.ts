import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';
import { MealCreateInput, MealUpdateInput } from '../validators/mealSchemas.js';
import { mealCardSelect } from './catalogShared.js';
import { requireOwnKitchen } from './kitchenService.js';
import { isUploadedMealPhotoUrl } from './uploadService.js';

// A chef managing their own meals. Every lookup is scoped to the chef, so one chef can
// never see or change another chef's meal (it simply looks "not found").

const ownMealSelect = {
  ...mealCardSelect,
  isAvailable: true,
  maxOrdersPerDay: true,
  totalOrders: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MealSelect;

type OwnMealRow = Prisma.MealGetPayload<{ select: typeof ownMealSelect }>;

function toOwnMeal(meal: OwnMealRow) {
  return {
    ...meal,
    price: meal.price.toNumber(),
    averageRating: meal.averageRating?.toNumber() ?? null,
  };
}

/** Photos must come from our own upload endpoint, unless the meal already had that photo. */
function assertAllowedPhoto(imageUrl: string | null | undefined, currentImageUrl: string | null) {
  if (imageUrl === undefined || imageUrl === null || imageUrl === currentImageUrl) return;
  if (!isUploadedMealPhotoUrl(imageUrl)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields', {
      imageUrl: 'Upload the photo here instead of linking to it',
    });
  }
}

async function findOwnMeal(chefId: string, mealId: string) {
  const meal = await prisma.meal.findFirst({ where: { id: mealId, chefId } });
  if (!meal) throw new AppError(404, 'NOT_FOUND', 'We could not find that meal');
  return meal;
}

export async function listOwnMeals(userId: string) {
  const chef = await requireOwnKitchen(userId);
  const meals = await prisma.meal.findMany({
    where: { chefId: chef.id },
    select: ownMealSelect,
    orderBy: { createdAt: 'desc' },
  });
  return meals.map(toOwnMeal);
}

export async function createMeal(userId: string, input: MealCreateInput) {
  const chef = await requireOwnKitchen(userId);
  assertAllowedPhoto(input.imageUrl, null);

  // Meals go on the chef's first active menu, which is created if needed.
  const menu =
    (await prisma.menu.findFirst({ where: { chefId: chef.id, isActive: true }, orderBy: { createdAt: 'asc' } })) ??
    (await prisma.menu.create({ data: { chefId: chef.id, name: 'Menu' } }));

  const meal = await prisma.meal.create({
    data: { ...input, chefId: chef.id, menuId: menu.id },
    select: ownMealSelect,
  });
  return toOwnMeal(meal);
}

export async function updateMeal(userId: string, mealId: string, input: MealUpdateInput) {
  const chef = await requireOwnKitchen(userId);
  const current = await findOwnMeal(chef.id, mealId);
  assertAllowedPhoto(input.imageUrl, current.imageUrl);

  const meal = await prisma.meal.update({ where: { id: current.id }, data: input, select: ownMealSelect });
  return toOwnMeal(meal);
}

export async function deleteMeal(userId: string, mealId: string) {
  const chef = await requireOwnKitchen(userId);
  const meal = await findOwnMeal(chef.id, mealId);

  const orderCount = await prisma.orderItem.count({ where: { mealId: meal.id } });
  if (orderCount > 0) {
    throw new AppError(
      409,
      'MEAL_HAS_ORDERS',
      'This meal has been ordered, so it is kept for order history. Hide it instead.',
    );
  }
  await prisma.meal.delete({ where: { id: meal.id } });
}
