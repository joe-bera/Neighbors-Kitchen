import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';
import { AvailabilityInput, KitchenProfileInput, KitchenUpdateInput } from '../validators/kitchenSchemas.js';
import { locateKitchen, toArea } from './locationService.js';

// A chef's own view of their kitchen, including private details such as the street address.

// Changing any of these moves the kitchen on the map (the apartment line does not).
const ADDRESS_FIELDS = ['addressLine1', 'city', 'state', 'zipCode'] as const;

const ownKitchenInclude = {
  availability: {
    orderBy: { dayOfWeek: 'asc' },
    select: { dayOfWeek: true, startTime: true, endTime: true },
  },
  _count: { select: { meals: true } },
} satisfies Prisma.ChefProfileInclude;

type OwnKitchenRow = Prisma.ChefProfileGetPayload<{ include: typeof ownKitchenInclude }>;

function toOwnKitchen(chef: OwnKitchenRow) {
  return {
    id: chef.id,
    kitchenName: chef.kitchenName,
    bio: chef.bio,
    specialties: chef.specialties,
    yearsExperience: chef.yearsExperience,
    certifications: chef.certifications,
    addressLine1: chef.addressLine1,
    addressLine2: chef.addressLine2,
    city: chef.city,
    state: chef.state,
    zipCode: chef.zipCode,
    // Where neighbors see the kitchen: an approximate area, never the street address.
    area: toArea(chef),
    serviceRadiusMiles: chef.serviceRadiusMiles.toNumber(),
    isAcceptingOrders: chef.isAcceptingOrders,
    orderLeadTimeHours: chef.orderLeadTimeHours,
    offersPickup: chef.offersPickup,
    offersDelivery: chef.offersDelivery,
    deliveryFee: chef.deliveryFee.toNumber(),
    timezone: chef.timezone,
    availability: chef.availability,
    averageRating: chef.averageRating?.toNumber() ?? null,
    totalReviews: chef.totalReviews,
    totalOrders: chef.totalOrders,
    mealCount: chef._count.meals,
    createdAt: chef.createdAt,
  };
}

function noKitchenYet() {
  return new AppError(404, 'NO_CHEF_PROFILE', 'Set up your kitchen first');
}

/** The signed-in chef's kitchen record, or a 404 telling them to set it up. */
export async function requireOwnKitchen(userId: string) {
  const chef = await prisma.chefProfile.findUnique({ where: { userId } });
  if (!chef) throw noKitchenYet();
  return chef;
}

/** Creates a kitchen for the user and makes them a chef (customers can upgrade). */
export async function becomeChef(userId: string, input: KitchenProfileInput) {
  const existing = await prisma.chefProfile.findUnique({ where: { userId }, select: { id: true } });
  if (existing) throw new AppError(409, 'ALREADY_CHEF', 'You already have a kitchen');

  const location = await locateKitchen(input);
  try {
    const chef = await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { role: 'CHEF' } });
      return tx.chefProfile.create({
        data: { ...input, ...location, userId, menus: { create: { name: 'Menu' } } },
        include: ownKitchenInclude,
      });
    });
    return toOwnKitchen(chef);
  } catch (error) {
    // Two setup requests at once: the second one loses on the unique user_id.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(409, 'ALREADY_CHEF', 'You already have a kitchen');
    }
    throw error;
  }
}

export async function getOwnKitchen(userId: string) {
  const chef = await prisma.chefProfile.findUnique({ where: { userId }, include: ownKitchenInclude });
  if (!chef) throw noKitchenYet();
  return toOwnKitchen(chef);
}

export async function updateOwnKitchen(userId: string, input: KitchenUpdateInput) {
  const current = await requireOwnKitchen(userId);
  const address = {
    addressLine1: input.addressLine1 ?? current.addressLine1,
    city: input.city ?? current.city,
    state: input.state ?? current.state,
    zipCode: input.zipCode ?? current.zipCode,
  };
  const moved = ADDRESS_FIELDS.some((field) => address[field] !== current[field]);
  const location = moved ? await locateKitchen(address) : {};
  const chef = await prisma.chefProfile.update({
    where: { id: current.id },
    data: { ...input, ...location },
    include: ownKitchenInclude,
  });
  return toOwnKitchen(chef);
}

/** Replaces the weekly schedule and saves how orders are handed over. */
export async function updateAvailability(userId: string, input: AvailabilityInput) {
  const { id } = await requireOwnKitchen(userId);
  const { schedule, ...fulfillment } = input;

  const chef = await prisma.$transaction(async (tx) => {
    await tx.chefAvailability.deleteMany({ where: { chefId: id } });
    if (schedule.length > 0) {
      await tx.chefAvailability.createMany({ data: schedule.map((window) => ({ ...window, chefId: id })) });
    }
    return tx.chefProfile.update({ where: { id }, data: fulfillment, include: ownKitchenInclude });
  });
  return toOwnKitchen(chef);
}
