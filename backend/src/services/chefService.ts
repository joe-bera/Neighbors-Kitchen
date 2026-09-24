import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';
import { ChefListQuery } from '../validators/catalogSchemas.js';
import { listOrderSlots } from './scheduling.js';
import {
  chefDisplayName,
  containsText,
  mealCardSelect,
  orderableMealOwnWhere,
  paginationMeta,
  recommendedOrder,
  titleCase,
  toMealCard,
  visibleChefWhere,
} from './catalogShared.js';

const chefCardInclude = {
  user: { select: { firstName: true, lastName: true, profilePhotoUrl: true } },
  _count: { select: { meals: { where: orderableMealOwnWhere } } },
  // The first meal photo doubles as the chef's cover image.
  meals: {
    where: { ...orderableMealOwnWhere, imageUrl: { not: null } },
    orderBy: { createdAt: 'asc' },
    take: 1,
    select: { imageUrl: true },
  },
} satisfies Prisma.ChefProfileInclude;

type ChefCardRow = Prisma.ChefProfileGetPayload<{ include: typeof chefCardInclude }>;

function toChefCard(chef: ChefCardRow) {
  return {
    id: chef.id,
    kitchenName: chef.kitchenName,
    chefName: chefDisplayName(chef.user),
    firstName: chef.user.firstName,
    profilePhotoUrl: chef.user.profilePhotoUrl,
    bio: chef.bio,
    city: chef.city,
    state: chef.state,
    specialties: chef.specialties,
    yearsExperience: chef.yearsExperience,
    averageRating: chef.averageRating?.toNumber() ?? null,
    totalReviews: chef.totalReviews,
    isAcceptingOrders: chef.isAcceptingOrders,
    mealCount: chef._count.meals,
    coverImageUrl: chef.meals[0]?.imageUrl ?? null,
  };
}

/** Matches kitchen name, bio, city, chef name, specialties, or anything on the chef's menu. */
function chefSearchWhere(term: string): Prisma.ChefProfileWhereInput {
  const text = containsText(term);
  return {
    OR: [
      { kitchenName: text },
      { bio: text },
      { city: text },
      { user: { firstName: text } },
      { user: { lastName: text } },
      { specialties: { hasSome: [term, titleCase(term)] } },
      {
        meals: {
          some: {
            ...orderableMealOwnWhere,
            OR: [{ name: text }, { cuisineType: text }, { dietaryTags: { has: term.toLowerCase() } }],
          },
        },
      },
    ],
  };
}

export async function listChefs({ search, city, cuisine, page, limit }: ChefListQuery) {
  const filters: Prisma.ChefProfileWhereInput[] = [
    visibleChefWhere,
    { meals: { some: orderableMealOwnWhere } },
  ];
  if (search) filters.push(chefSearchWhere(search));
  if (city) filters.push({ city: { equals: city, mode: 'insensitive' } });
  if (cuisine) {
    filters.push({
      OR: [
        { specialties: { hasSome: [cuisine, titleCase(cuisine)] } },
        { meals: { some: { ...orderableMealOwnWhere, cuisineType: { equals: cuisine, mode: 'insensitive' } } } },
      ],
    });
  }
  const where: Prisma.ChefProfileWhereInput = { AND: filters };

  const [total, chefs] = await prisma.$transaction([
    prisma.chefProfile.count({ where }),
    prisma.chefProfile.findMany({
      where,
      include: chefCardInclude,
      orderBy: recommendedOrder,
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { chefs: chefs.map(toChefCard), pagination: paginationMeta(page, limit, total) };
}

/** The pre-order times a customer can pick from right now. */
export async function getOrderSlots(id: string) {
  const chef = await prisma.chefProfile.findFirst({
    where: { id, ...visibleChefWhere },
    select: { timezone: true, orderLeadTimeHours: true, isAcceptingOrders: true, availability: true },
  });
  if (!chef) throw new AppError(404, 'NOT_FOUND', 'We could not find that chef');
  return {
    timezone: chef.timezone,
    isAcceptingOrders: chef.isAcceptingOrders,
    days: chef.isAcceptingOrders ? listOrderSlots(chef) : [],
  };
}

export async function getChefProfile(id: string) {
  const chef = await prisma.chefProfile.findFirst({
    where: { id, ...visibleChefWhere },
    include: {
      ...chefCardInclude,
      availability: {
        orderBy: { dayOfWeek: 'asc' },
        select: { dayOfWeek: true, startTime: true, endTime: true },
      },
      menus: {
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        include: {
          meals: { where: { isAvailable: true }, orderBy: { createdAt: 'asc' }, select: mealCardSelect },
        },
      },
    },
  });
  if (!chef) throw new AppError(404, 'NOT_FOUND', 'We could not find that chef');

  return {
    ...toChefCard(chef),
    certifications: chef.certifications,
    serviceRadiusMiles: chef.serviceRadiusMiles.toNumber(),
    memberSince: chef.createdAt,
    availability: chef.availability,
    orderLeadTimeHours: chef.orderLeadTimeHours,
    offersPickup: chef.offersPickup,
    offersDelivery: chef.offersDelivery,
    deliveryFee: chef.deliveryFee.toNumber(),
    menus: chef.menus
      .filter((menu) => menu.meals.length > 0)
      .map((menu) => ({
        id: menu.id,
        name: menu.name,
        description: menu.description,
        meals: menu.meals.map(toMealCard),
      })),
  };
}
