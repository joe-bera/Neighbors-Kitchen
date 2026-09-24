import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';
import { ChefListQuery, ChefMapQuery } from '../validators/catalogSchemas.js';
import { distanceMiles, LatLng, roundToTenth } from './geo.js';
import { areaCenter, resolveOrigin, toArea } from './locationService.js';
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

function toChefCard(chef: ChefCardRow, distance: number | null = null) {
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
    distanceMiles: distance === null ? null : roundToTenth(distance),
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

type ChefFilters = Pick<ChefListQuery, 'search' | 'city' | 'cuisine'>;

/** Chefs a search can show: visible, with something to order, matching the text, city and cuisine filters. */
function chefListWhere({ search, city, cuisine }: ChefFilters): Prisma.ChefProfileWhereInput {
  const filters: Prisma.ChefProfileWhereInput[] = [visibleChefWhere, { meals: { some: orderableMealOwnWhere } }];
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
  return { AND: filters };
}

const hasArea = { approxLatitude: { not: null }, approxLongitude: { not: null } } satisfies Prisma.ChefProfileWhereInput;

interface RankedChef {
  id: string;
  distance: number;
}

/**
 * Chefs with a map area, nearest to `origin` first (ties in id order), within `maxDistance` miles when given.
 * Distances are measured to each chef's public area center, never to their real location.
 */
async function rankByDistance(where: Prisma.ChefProfileWhereInput, origin: LatLng, maxDistance?: number) {
  const rows = await prisma.chefProfile.findMany({
    where: { AND: [where, hasArea] },
    select: { id: true, approxLatitude: true, approxLongitude: true },
  });
  return rows
    .map((row): RankedChef => ({ id: row.id, distance: distanceMiles(origin, areaCenter(row)!) }))
    .filter((row) => maxDistance === undefined || row.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
}

/** Rows in ranking order. A chef hidden between the two queries is skipped. */
function inRankedOrder<T extends { id: string }>(ranked: RankedChef[], rows: T[]) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ranked.flatMap(({ id, distance }) => {
    const row = byId.get(id);
    return row ? [{ row, distance }] : [];
  });
}

export async function listChefs(query: ChefListQuery) {
  const { page, limit } = query;
  const where = chefListWhere(query);
  const origin = resolveOrigin(query);

  if (!origin) {
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
    // An arrow function, so map's index is never taken for a distance.
    return { chefs: chefs.map((chef) => toChefCard(chef)), pagination: paginationMeta(page, limit, total) };
  }

  const ranked = await rankByDistance(where, origin, query.maxDistance);
  const onThisPage = ranked.slice((page - 1) * limit, page * limit);
  const cards = await prisma.chefProfile.findMany({
    where: { id: { in: onThisPage.map((chef) => chef.id) } },
    include: chefCardInclude,
  });
  return {
    chefs: inRankedOrder(onThisPage, cards).map(({ row, distance }) => toChefCard(row, distance)),
    pagination: paginationMeta(page, limit, ranked.length),
  };
}

const MAP_LIMIT = 500;

const mapPinSelect = {
  id: true,
  kitchenName: true,
  city: true,
  averageRating: true,
  totalReviews: true,
  isAcceptingOrders: true,
  approxLatitude: true,
  approxLongitude: true,
  user: { select: { firstName: true, lastName: true } },
} satisfies Prisma.ChefProfileSelect;

type MapPinRow = Prisma.ChefProfileGetPayload<{ select: typeof mapPinSelect }>;

function toMapPin(chef: MapPinRow, distance: number | null) {
  return {
    id: chef.id,
    kitchenName: chef.kitchenName,
    chefName: chefDisplayName(chef.user),
    firstName: chef.user.firstName,
    city: chef.city,
    averageRating: chef.averageRating?.toNumber() ?? null,
    totalReviews: chef.totalReviews,
    isAcceptingOrders: chef.isAcceptingOrders,
    distanceMiles: distance === null ? null : roundToTenth(distance),
    area: toArea(chef),
  };
}

/** Every matching chef's public area for the map, nearest first when searching from a place. */
export async function listChefsForMap(query: ChefMapQuery) {
  const where = chefListWhere(query);
  const origin = resolveOrigin(query);

  if (!origin) {
    const chefs = await prisma.chefProfile.findMany({
      where: { AND: [where, hasArea] },
      select: mapPinSelect,
      orderBy: recommendedOrder,
      take: MAP_LIMIT,
    });
    return { origin: null, chefs: chefs.map((chef) => toMapPin(chef, null)) };
  }

  const ranked = (await rankByDistance(where, origin, query.maxDistance)).slice(0, MAP_LIMIT);
  const rows = await prisma.chefProfile.findMany({ where: { id: { in: ranked.map((chef) => chef.id) } }, select: mapPinSelect });
  return { origin, chefs: inRankedOrder(ranked, rows).map(({ row, distance }) => toMapPin(row, distance)) };
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
    area: toArea(chef),
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
