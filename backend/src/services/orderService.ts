import crypto from 'node:crypto';
import { ChefProfile, OrderStatus, Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';
import { PlaceOrderInput } from '../validators/orderSchemas.js';
import { chefDisplayName, chefSummarySelect, orderableMealOwnWhere, toChefSummary, visibleChefWhere } from './catalogShared.js';
import { distanceMiles, roundToTenth } from './geo.js';
import { geocodeAddress } from './geocoding.js';
import { requireOwnKitchen } from './kitchenService.js';
import { areaCenter } from './locationService.js';
import { notify } from './notifications/notify.js';
import { orderNoticeData, orderParties } from './notifications/orderNotices.js';
import { orderReviewSelect } from './reviewService.js';
import { isOrderSlot, localDayBounds } from './scheduling.js';
import { zipCentroid, zipFromAddress } from './zipCodes.js';

// Order lifecycle: PENDING -> CONFIRMED -> PREPARING -> READY -> COMPLETED, or CANCELLED along the way.
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  PENDING: 'CONFIRMED',
  CONFIRMED: 'PREPARING',
  PREPARING: 'READY',
  READY: 'COMPLETED',
};
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * When a new order must be confirmed by: the chef's promise, or the pickup or delivery time if that
 * comes first. The chef is reminded halfway there.
 */
export function confirmationTimes(placedAt: Date, scheduledFor: Date, confirmWithinHours: number) {
  const confirmBy = new Date(Math.min(placedAt.getTime() + confirmWithinHours * HOUR_MS, scheduledFor.getTime()));
  const chefReminderAt = new Date(placedAt.getTime() + (confirmBy.getTime() - placedAt.getTime()) / 2);
  return { confirmBy, chefReminderAt };
}
const OPEN_STATUSES: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'];
const CLOSED_STATUSES: OrderStatus[] = ['COMPLETED', 'CANCELLED'];
// Customers can cancel until the chef starts cooking.
const CUSTOMER_CANCELLABLE: OrderStatus[] = ['PENDING', 'CONFIRMED'];
// The chef's street address is shared with the customer once the chef confirms a pickup order.
const PICKUP_ADDRESS_SHARED: OrderStatus[] = ['CONFIRMED', 'PREPARING', 'READY', 'COMPLETED'];

const STATUS_WORDS: Record<OrderStatus, string> = {
  PENDING: 'waiting for the chef',
  CONFIRMED: 'confirmed',
  PREPARING: 'being prepared',
  READY: 'ready',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

// What the customer hears when the chef moves their order along.
const CUSTOMER_NOTICE: Partial<Record<OrderStatus, 'ORDER_CONFIRMED' | 'ORDER_PREPARING' | 'ORDER_READY'>> = {
  CONFIRMED: 'ORDER_CONFIRMED',
  PREPARING: 'ORDER_PREPARING',
  READY: 'ORDER_READY',
};

const ORDER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no look-alikes such as 0/O or 1/I

function newOrderNumber(): string {
  return `NK-${Array.from(crypto.randomBytes(6), (byte) => ORDER_CODE_ALPHABET[byte % ORDER_CODE_ALPHABET.length]).join('')}`;
}

const orderInclude = {
  orderItems: { orderBy: { createdAt: 'asc' } },
  events: { orderBy: { createdAt: 'asc' }, select: { status: true, note: true, createdAt: true } },
  chef: {
    select: {
      ...chefSummarySelect,
      userId: true,
      timezone: true,
      addressLine1: true,
      addressLine2: true,
      zipCode: true,
    },
  },
  customer: { select: { firstName: true, lastName: true } },
  reviews: { orderBy: { createdAt: 'asc' }, select: orderReviewSelect },
} satisfies Prisma.OrderInclude;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

const money = (value: Prisma.Decimal) => value.toNumber();

function formatAddress(chef: OrderRow['chef']): string {
  const street = [chef.addressLine1, chef.addressLine2].filter(Boolean).join(', ');
  return `${street}, ${chef.city}, ${chef.state} ${chef.zipCode}`;
}

function sharedView(order: OrderRow) {
  const { addressLine1: _line1, addressLine2: _line2, zipCode: _zip, userId: _userId, timezone, ...chef } = order.chef;
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    pickupOrDelivery: order.pickupOrDelivery,
    scheduledFor: order.scheduledFor,
    confirmBy: order.confirmBy,
    timezone,
    subtotal: money(order.subtotal),
    deliveryFee: money(order.deliveryFee),
    total: money(order.total),
    deliveryAddress: order.deliveryAddress,
    contactPhone: order.contactPhone,
    specialInstructions: order.specialInstructions,
    cancellationReason: order.cancellationReason,
    cancelledAt: order.cancelledAt,
    completedAt: order.completedAt,
    createdAt: order.createdAt,
    chef: toChefSummary(chef),
    items: order.orderItems.map((item) => ({
      mealId: item.mealId,
      mealName: item.mealName,
      quantity: item.quantity,
      priceAtPurchase: money(item.priceAtPurchase),
      lineTotal: money(item.priceAtPurchase.mul(item.quantity)),
    })),
    events: order.events,
  };
}

/** What the customer who placed the order sees. The platform's commission is not shown. */
function customerView(order: OrderRow) {
  const sharePickupAddress = order.pickupOrDelivery === 'PICKUP' && PICKUP_ADDRESS_SHARED.includes(order.status);
  return {
    ...sharedView(order),
    pickupAddress: sharePickupAddress ? formatAddress(order.chef) : null,
    canCancel: CUSTOMER_CANCELLABLE.includes(order.status),
    // Each meal of a completed order can be rated once.
    canReview: order.status === 'COMPLETED',
    reviews: order.reviews,
  };
}

/** What the chef who received the order sees, including their payout. */
function chefView(order: OrderRow) {
  return {
    ...sharedView(order),
    customer: { name: chefDisplayName(order.customer) },
    platformFee: money(order.platformFee),
    chefPayout: money(order.total.sub(order.platformFee)),
    nextStatus: NEXT_STATUS[order.status] ?? null,
    canCancel: OPEN_STATUSES.includes(order.status),
    deliveryDistanceMiles: order.deliveryDistanceMiles?.toNumber() ?? null,
  };
}

// A ZIP code's middle can be miles from the address itself, so an address judged only by its ZIP code
// is refused just when that ZIP code is this much farther than the chef delivers.
const ZIP_MARGIN_MILES = 5;

/**
 * Miles from the chef's public area to a delivery address, or null when either cannot be placed on
 * the map precisely (the order then goes ahead, and the chef can decline it). Refuses addresses
 * farther than the chef delivers; an address that cannot be found is refused only when its ZIP code
 * is clearly too far.
 */
async function deliveryDistance(chef: ChefProfile, address: string): Promise<number | null> {
  // A kitchen placed only by its ZIP code could really be miles from that spot, so it is not measured.
  if (chef.locationPrecision !== 'ADDRESS') return null;
  const kitchenArea = areaCenter(chef);
  if (!kitchenArea) return null;
  const limit = chef.serviceRadiusMiles.toNumber();
  const outsideDeliveryArea = (why: string) => {
    const message = `${chef.kitchenName ?? 'This chef'} delivers up to ${limit} miles from their kitchen. ${why}`;
    return new AppError(409, 'OUTSIDE_DELIVERY_AREA', message, { deliveryAddress: message });
  };

  const destination = await geocodeAddress(address);
  if (!destination) {
    const zip = zipFromAddress(address);
    const zipCenter = zip && zipCentroid(zip);
    if (!zipCenter) return null;
    const zipMiles = roundToTenth(distanceMiles(kitchenArea, zipCenter));
    if (zipMiles > limit + ZIP_MARGIN_MILES) {
      throw outsideDeliveryArea(
        `We could not find this exact address, and its ZIP code ${zip} is about ${zipMiles} miles away. Please check the address or choose pickup.`,
      );
    }
    return null;
  }

  const miles = roundToTenth(distanceMiles(kitchenArea, destination));
  if (miles > limit) {
    throw outsideDeliveryArea(`This address is about ${miles} miles away. Please choose pickup or another address.`);
  }
  return miles;
}

export async function placeOrder(userId: string, input: PlaceOrderInput) {
  const chef = await prisma.chefProfile.findFirst({
    where: { id: input.chefId, ...visibleChefWhere },
    include: { availability: true },
  });
  if (!chef) throw new AppError(404, 'CHEF_NOT_FOUND', 'We could not find that chef');
  if (chef.userId === userId) throw new AppError(409, 'OWN_KITCHEN', 'You cannot order from your own kitchen');
  if (!chef.isAcceptingOrders) {
    throw new AppError(409, 'NOT_ACCEPTING_ORDERS', 'This chef is not taking new orders right now');
  }
  const isDelivery = input.pickupOrDelivery === 'DELIVERY';
  if (isDelivery && !chef.offersDelivery) {
    throw new AppError(409, 'DELIVERY_NOT_OFFERED', 'This chef does not deliver. Please choose pickup.');
  }
  if (!isDelivery && !chef.offersPickup) {
    throw new AppError(409, 'PICKUP_NOT_OFFERED', 'This chef only delivers. Please choose delivery.');
  }
  if (!isOrderSlot(chef, input.scheduledFor)) {
    throw new AppError(422, 'INVALID_TIME', 'That time is not available. Please choose another time.', {
      scheduledFor: 'Choose one of the available times',
    });
  }
  // Looked up before the transaction: never hold database locks while waiting on another service.
  const deliveryDistanceMiles = isDelivery ? await deliveryDistance(chef, input.deliveryAddress ?? '') : null;

  const order = await prisma.$transaction(async (tx) => {
    const mealIds = input.items.map((item) => item.mealId);
    // Lock these meals so two customers cannot both take the last portions of the day.
    await tx.$queryRaw`SELECT id FROM meals WHERE id IN (${Prisma.join(mealIds)}) FOR UPDATE`;

    const meals = await tx.meal.findMany({ where: { id: { in: mealIds }, chefId: chef.id, ...orderableMealOwnWhere } });
    if (meals.length !== mealIds.length) {
      throw new AppError(409, 'MEAL_UNAVAILABLE', 'Some items in your cart are no longer available. Please review your cart.');
    }
    const mealsById = new Map(meals.map((meal) => [meal.id, meal]));

    const { start, end } = localDayBounds(chef.timezone, input.scheduledFor);
    for (const item of input.items) {
      const meal = mealsById.get(item.mealId)!;
      if (meal.maxOrdersPerDay === null) continue;
      const alreadyOrdered = await tx.orderItem.aggregate({
        _sum: { quantity: true },
        where: { mealId: meal.id, order: { status: { not: 'CANCELLED' }, scheduledFor: { gte: start, lt: end } } },
      });
      const remaining = meal.maxOrdersPerDay - (alreadyOrdered._sum.quantity ?? 0);
      if (item.quantity > remaining) {
        throw new AppError(
          409,
          'SOLD_OUT',
          remaining > 0
            ? `Only ${remaining} more ${meal.name} can be ordered for that day.`
            : `${meal.name} is sold out for that day. Please choose another day.`,
        );
      }
    }

    // Prices always come from the menu, never from the browser.
    const lines = input.items.map((item) => {
      const meal = mealsById.get(item.mealId)!;
      return { mealId: meal.id, mealName: meal.name, quantity: item.quantity, priceAtPurchase: meal.price };
    });
    const subtotal = lines.reduce((sum, line) => sum.add(line.priceAtPurchase.mul(line.quantity)), new Prisma.Decimal(0));
    const deliveryFee = isDelivery ? chef.deliveryFee : new Prisma.Decimal(0);
    const platformFee = subtotal.mul(env.PLATFORM_FEE_PERCENT).div(100).toDecimalPlaces(2);

    const created = await tx.order.create({
      data: {
        orderNumber: newOrderNumber(),
        customerId: userId,
        chefId: chef.id,
        subtotal,
        deliveryFee,
        platformFee,
        total: subtotal.add(deliveryFee),
        pickupOrDelivery: input.pickupOrDelivery,
        scheduledFor: input.scheduledFor,
        // Pickup times are at least the chef's lead time (1 hour or more) away, so the deadline is always ahead.
        ...confirmationTimes(new Date(), input.scheduledFor, chef.confirmWithinHours),
        deliveryAddress: isDelivery ? input.deliveryAddress : null,
        deliveryDistanceMiles,
        contactPhone: input.contactPhone,
        specialInstructions: input.specialInstructions,
        orderItems: { create: lines },
        events: { create: { status: 'PENDING' } },
      },
      include: orderInclude,
    });
    const parties = await orderParties(tx, created);
    const notice = orderNoticeData(created);
    await notify(tx, parties.chef, 'NEW_ORDER', notice);
    await notify(tx, parties.customer, 'ORDER_PLACED', notice);
    return created;
  });

  return customerView(order);
}

export async function listCustomerOrders(userId: string) {
  const orders = await prisma.order.findMany({
    where: { customerId: userId },
    include: orderInclude,
    orderBy: { scheduledFor: 'desc' },
  });
  return orders.map(customerView);
}

/** An order as seen by whoever asks: its customer, or the chef who received it. Anyone else gets a 404. */
export async function getOrderForUser(userId: string, orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: orderInclude });
  if (order?.customerId === userId) return customerView(order);
  if (order?.chef.userId === userId) return chefView(order);
  throw new AppError(404, 'NOT_FOUND', 'We could not find that order');
}

export async function listChefOrders(userId: string, view?: 'active' | 'past') {
  const chef = await requireOwnKitchen(userId);
  const orders = await prisma.order.findMany({
    where: {
      chefId: chef.id,
      ...(view && { status: { in: view === 'active' ? OPEN_STATUSES : CLOSED_STATUSES } }),
    },
    include: orderInclude,
    // Upcoming work soonest first; history most recent first.
    orderBy: { scheduledFor: view === 'past' ? 'desc' : 'asc' },
  });
  return orders.map(chefView);
}

async function findChefOrder(userId: string, orderId: string) {
  const chef = await requireOwnKitchen(userId);
  const order = await prisma.order.findFirst({ where: { id: orderId, chefId: chef.id } });
  if (!order) throw new AppError(404, 'NOT_FOUND', 'We could not find that order');
  return order;
}

/** Moves an order to its next step. Only the chef who received it can do this, one step at a time. */
export async function advanceOrderStatus(userId: string, orderId: string, status: OrderStatus) {
  const order = await findChefOrder(userId, orderId);
  const invalidChange = () =>
    new AppError(409, 'INVALID_STATUS_CHANGE', `This order is ${STATUS_WORDS[order.status]}, so it cannot be marked ${STATUS_WORDS[status]}.`);
  if (NEXT_STATUS[order.status] !== status) throw invalidChange();

  const updated = await prisma.$transaction(async (tx) => {
    const now = new Date();
    // Only succeeds if nobody else changed the order in the meantime (e.g. a double click).
    const { count } = await tx.order.updateMany({
      where: { id: order.id, status: order.status },
      data: {
        status,
        // A completed order gets its rate-your-meal reminder a little later.
        ...(status === 'COMPLETED' && {
          completedAt: now,
          rateReminderAt: new Date(now.getTime() + env.RATE_REMINDER_DELAY_MINUTES * MINUTE_MS),
        }),
      },
    });
    if (count === 0) throw invalidChange();
    await tx.orderEvent.create({ data: { orderId: order.id, status } });

    if (status === 'COMPLETED') {
      await tx.chefProfile.update({ where: { id: order.chefId }, data: { totalOrders: { increment: 1 } } });
      const items = await tx.orderItem.findMany({ where: { orderId: order.id }, select: { mealId: true } });
      await tx.meal.updateMany({ where: { id: { in: items.map((item) => item.mealId) } }, data: { totalOrders: { increment: 1 } } });
    }
    const changed = await tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
    const kind = CUSTOMER_NOTICE[status];
    if (kind) {
      const { customer } = await orderParties(tx, changed);
      await notify(tx, customer, kind, orderNoticeData(changed));
    }
    return changed;
  });
  return chefView(updated);
}

async function cancelOrder(orderId: string, allowedStatuses: OrderStatus[], reason: string | null, cancelledBy: 'customer' | 'chef') {
  return prisma.$transaction(async (tx) => {
    // Lock the order, so the status read here is still the status when it is cancelled.
    const [current] = await tx.$queryRaw<{ status: OrderStatus }[]>`SELECT status FROM orders WHERE id = ${orderId} FOR UPDATE`;
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: { in: allowedStatuses } },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: reason },
    });
    if (count === 0) {
      throw new AppError(409, 'CANNOT_CANCEL', 'This order can no longer be cancelled. Please contact the chef.');
    }
    await tx.orderEvent.create({ data: { orderId, status: 'CANCELLED', note: reason } });
    const cancelled = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });

    const parties = await orderParties(tx, cancelled);
    if (cancelledBy === 'chef') {
      // A chef who never confirmed the order declined it.
      const notice = orderNoticeData(cancelled, { declined: current.status === 'PENDING' });
      await notify(tx, parties.customer, 'ORDER_CANCELLED_BY_CHEF', notice);
    } else {
      await notify(tx, parties.chef, 'ORDER_CANCELLED_BY_CUSTOMER', orderNoticeData(cancelled));
    }
    return cancelled;
  });
}

export async function cancelOrderAsCustomer(userId: string, orderId: string, reason: string | null) {
  const order = await prisma.order.findFirst({ where: { id: orderId, customerId: userId } });
  if (!order) throw new AppError(404, 'NOT_FOUND', 'We could not find that order');
  return customerView(await cancelOrder(order.id, CUSTOMER_CANCELLABLE, reason, 'customer'));
}

export async function cancelOrderAsChef(userId: string, orderId: string, reason: string | null) {
  const order = await findChefOrder(userId, orderId);
  return chefView(await cancelOrder(order.id, OPEN_STATUSES, reason, 'chef'));
}
