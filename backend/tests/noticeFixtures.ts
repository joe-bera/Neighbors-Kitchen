import { DishRequestNoticeData, OrderNoticeData, ReviewNoticeData } from '../src/services/notifications/kinds.js';

// Sample notice data for tests of the wording.
// 2026-09-30T01:00Z is 6:00 PM and 2026-09-29T22:15Z is 3:15 PM on Tuesday, September 29, 2026, in Los Angeles.

export const sampleOrder: OrderNoticeData = {
  orderId: 'order-1',
  orderNumber: 'NK-7QX4PD',
  chefId: 'chef-1',
  kitchenName: "Abuela's Table",
  customerName: 'Dana K.',
  items: [
    { name: 'Chicken Enchilada Casserole', quantity: 2 },
    { name: 'Churros', quantity: 1 },
  ],
  scheduledFor: '2026-09-30T01:00:00.000Z',
  timezone: 'America/Los_Angeles',
  pickupOrDelivery: 'PICKUP',
  total: 33,
  chefPayout: 29.7,
  confirmBy: '2026-09-29T22:15:00.000Z',
  reason: null,
};

export const sampleRequest: DishRequestNoticeData = {
  suggestionId: 'request-1',
  chefId: 'chef-1',
  kitchenName: "Abuela's Table",
  mealName: 'Birria tacos',
  description: 'Slow-cooked beef birria with consommé for dipping, please!',
  status: 'CONSIDERING',
  reply: 'Testing my family recipe this month.',
  requesterName: 'Dana K.',
};

export const sampleReview: ReviewNoticeData = {
  reviewId: 'review-1',
  chefId: 'chef-1',
  mealName: 'Chicken Enchilada Casserole',
  rating: 5,
  comment: "Tasted just like my tía's.",
  customerName: 'Dana K.',
};
