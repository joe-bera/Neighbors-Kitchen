import { PickupOrDelivery, Prisma } from '@prisma/client';
import { chefDisplayName, kitchenTitle } from '../catalogShared.js';
import { OrderNoticeData } from './kinds.js';
import { Recipient, recipientSelect } from './notify.js';

/** The order fields an order notice is built from. The order views in orderService load all of them. */
export interface OrderForNotice {
  id: string;
  orderNumber: string;
  chefId: string;
  customerId: string;
  scheduledFor: Date;
  pickupOrDelivery: PickupOrDelivery;
  total: Prisma.Decimal;
  platformFee: Prisma.Decimal;
  cancellationReason: string | null;
  confirmBy: Date | null;
  orderItems: { mealName: string; quantity: number }[];
  chef: { userId: string; kitchenName: string | null; timezone: string; user: { firstName: string } };
  customer: { firstName: string; lastName: string };
}

/** Loads what orderNoticeData needs, for code that does not already have the full order. */
export const orderNoticeInclude = {
  orderItems: { orderBy: { createdAt: 'asc' }, select: { mealId: true, mealName: true, quantity: true } },
  chef: { select: { userId: true, kitchenName: true, timezone: true, user: { select: { firstName: true } } } },
  customer: { select: { firstName: true, lastName: true } },
} satisfies Prisma.OrderInclude;

/** A snapshot of the order for its notices. It never holds addresses or phone numbers. */
export function orderNoticeData(
  order: OrderForNotice,
  extra: { reason?: string | null; declined?: boolean } = {},
): OrderNoticeData {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    chefId: order.chefId,
    kitchenName: kitchenTitle(order.chef),
    customerName: chefDisplayName(order.customer),
    items: order.orderItems.map((item) => ({ name: item.mealName, quantity: item.quantity })),
    scheduledFor: order.scheduledFor.toISOString(),
    timezone: order.chef.timezone,
    pickupOrDelivery: order.pickupOrDelivery,
    total: order.total.toNumber(),
    chefPayout: order.total.sub(order.platformFee).toNumber(),
    confirmBy: order.confirmBy?.toISOString() ?? null,
    reason: extra.reason ?? order.cancellationReason,
    ...(extra.declined !== undefined && { declined: extra.declined }),
  };
}

/** The customer and the chef of an order, ready to pass to notify(). */
export async function orderParties(
  tx: Prisma.TransactionClient,
  order: { customerId: string; chef: { userId: string } },
): Promise<{ customer: Recipient; chef: Recipient }> {
  const [customer, chef] = await Promise.all([
    tx.user.findUniqueOrThrow({ where: { id: order.customerId }, select: recipientSelect }),
    tx.user.findUniqueOrThrow({ where: { id: order.chef.userId }, select: recipientSelect }),
  ]);
  return { customer, chef };
}
