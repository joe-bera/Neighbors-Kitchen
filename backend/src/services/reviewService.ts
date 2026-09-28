import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError, errorMessage } from '../utils/errors.js';
import { CreateReviewInput } from '../validators/feedbackSchemas.js';
import { chefDisplayName, orderableMealWhere, paginationMeta, visibleChefWhere } from './catalogShared.js';
import { requireOwnKitchen } from './kitchenService.js';
import { notify, recipientSelect } from './notifications/notify.js';
import { orderNoticeData, orderNoticeInclude } from './notifications/orderNotices.js';

// Customers rate each meal of a completed order once (1-5 stars, optional comment).
// Chefs can reply publicly; anyone signed in can report a review for a moderator.

const reviewSelect = {
  id: true,
  rating: true,
  comment: true,
  createdAt: true,
  chefResponse: true,
  chefRespondedAt: true,
  customer: { select: { firstName: true, lastName: true } },
  meal: { select: { id: true, name: true } },
} satisfies Prisma.ReviewSelect;

type ReviewRow = Prisma.ReviewGetPayload<{ select: typeof reviewSelect }>;

function toPublicReview(review: ReviewRow) {
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    customerName: chefDisplayName(review.customer),
    meal: review.meal,
    chefResponse: review.chefResponse,
    chefRespondedAt: review.chefRespondedAt,
  };
}

function notFound(what: string) {
  return new AppError(404, 'NOT_FOUND', `We could not find that ${what}`);
}

/** Recomputes the average rating and review count shown on a meal and on its chef. */
async function refreshRatings(tx: Prisma.TransactionClient, mealId: string, chefId: string) {
  const [mealStats, chefStats] = await Promise.all([
    tx.review.aggregate({ where: { mealId }, _avg: { rating: true }, _count: true }),
    tx.review.aggregate({ where: { chefId }, _avg: { rating: true }, _count: true }),
  ]);
  const average = (value: number | null) => (value === null ? null : new Prisma.Decimal(value).toDecimalPlaces(2));
  await tx.meal.update({
    where: { id: mealId },
    data: { averageRating: average(mealStats._avg.rating), totalReviews: mealStats._count },
  });
  await tx.chefProfile.update({
    where: { id: chefId },
    data: { averageRating: average(chefStats._avg.rating), totalReviews: chefStats._count },
  });
}

export async function createReview(userId: string, input: CreateReviewInput) {
  const order = await prisma.order.findFirst({
    where: { id: input.orderId, customerId: userId },
    select: { id: true, status: true, chefId: true, orderItems: { select: { mealId: true } } },
  });
  if (!order) throw notFound('order');
  if (order.status !== 'COMPLETED') {
    throw new AppError(409, 'ORDER_NOT_COMPLETED', 'You can review meals once the order is completed');
  }
  if (!order.orderItems.some((item) => item.mealId === input.mealId)) {
    throw new AppError(409, 'MEAL_NOT_IN_ORDER', 'That meal was not part of this order');
  }

  try {
    const review = await prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          orderId: order.id,
          mealId: input.mealId,
          chefId: order.chefId,
          customerId: userId,
          rating: input.rating,
          comment: input.comment,
        },
        select: reviewSelect,
      });
      await refreshRatings(tx, input.mealId, order.chefId);
      const { user: chef } = await tx.chefProfile.findUniqueOrThrow({
        where: { id: order.chefId },
        select: { user: { select: recipientSelect } },
      });
      await notify(tx, chef, 'NEW_REVIEW', {
        reviewId: created.id,
        chefId: order.chefId,
        mealName: created.meal.name,
        rating: created.rating,
        comment: created.comment,
        customerName: chefDisplayName(created.customer),
      });
      return created;
    });
    return toPublicReview(review);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(409, 'ALREADY_REVIEWED', 'You have already reviewed this meal from this order');
    }
    throw error;
  }
}

async function listReviews(where: Prisma.ReviewWhereInput, page: number, limit: number) {
  const [total, reviews] = await prisma.$transaction([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      select: reviewSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return { reviews: reviews.map(toPublicReview), pagination: paginationMeta(page, limit, total) };
}

export async function listChefReviews(chefId: string, page: number, limit: number) {
  const chef = await prisma.chefProfile.findFirst({ where: { id: chefId, ...visibleChefWhere }, select: { id: true } });
  if (!chef) throw notFound('chef');
  return listReviews({ chefId: chef.id }, page, limit);
}

export async function listMealReviews(mealId: string, page: number, limit: number) {
  const meal = await prisma.meal.findFirst({ where: { id: mealId, ...orderableMealWhere }, select: { id: true } });
  if (!meal) throw notFound('meal');
  return listReviews({ mealId: meal.id }, page, limit);
}

export async function listOwnKitchenReviews(userId: string, page: number, limit: number) {
  const chef = await requireOwnKitchen(userId);
  return listReviews({ chefId: chef.id }, page, limit);
}

/** The chef's public reply to a review of their kitchen. Replying again replaces the reply. */
export async function respondToReview(userId: string, reviewId: string, response: string) {
  const chef = await requireOwnKitchen(userId);
  const { count } = await prisma.review.updateMany({
    where: { id: reviewId, chefId: chef.id },
    data: { chefResponse: response, chefRespondedAt: new Date() },
  });
  if (count === 0) throw notFound('review');
  return toPublicReview(await prisma.review.findUniqueOrThrow({ where: { id: reviewId }, select: reviewSelect }));
}

/** Flags a review so a moderator can look at it. It stays visible until someone acts on it. */
export async function reportReview(reviewId: string, reason: string | null) {
  const { count } = await prisma.review.updateMany({
    where: { id: reviewId },
    data: { isFlagged: true, flagReason: reason },
  });
  if (count === 0) throw notFound('review');
}

/** Which meals of an order its customer has already rated. */
export const orderReviewSelect = {
  mealId: true,
  rating: true,
  comment: true,
  createdAt: true,
  chefResponse: true,
} satisfies Prisma.ReviewSelect;

/** Sends the rate-your-meal reminders that are due. Returns how many were sent. */
export async function sendRateReminders(now: Date = new Date()): Promise<number> {
  const due = await prisma.order.findMany({
    where: { status: 'COMPLETED', rateReminderAt: { lte: now } },
    orderBy: { rateReminderAt: 'asc' },
    take: 50,
    select: { id: true },
  });

  let sent = 0;
  for (const { id } of due) {
    // One order that cannot be handled must not hold up the others; it is tried again on the next pass.
    try {
      const reminded = await prisma.$transaction(async (tx) => {
        // Only one helper can take the reminder. It is cleared whether or not it is sent.
        const { count } = await tx.order.updateMany({ where: { id, rateReminderAt: { lte: now } }, data: { rateReminderAt: null } });
        if (count === 0) return false;
        const order = await tx.order.findUniqueOrThrow({
          where: { id },
          include: { ...orderNoticeInclude, reviews: { select: { mealId: true } } },
        });
        const somethingUnrated = order.orderItems.some((item) => !order.reviews.some((rated) => rated.mealId === item.mealId));
        if (!somethingUnrated) return false;
        const customer = await tx.user.findUniqueOrThrow({ where: { id: order.customerId }, select: recipientSelect });
        await notify(tx, customer, 'RATE_REMINDER', orderNoticeData(order));
        return true;
      });
      if (reminded) sent += 1;
    } catch (error) {
      console.error(`Could not send the rate reminder for order ${id}:`, errorMessage(error));
    }
  }
  return sent;
}
