import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { addMeal, API, bearer, completedOrder, openKitchen, pickupOrder, placeOrder, signUp } from './helpers.js';

const app = createApp();

function review(accessToken: string, body: Record<string, unknown>) {
  return request(app).post(`${API}/reviews`).set(bearer(accessToken)).send(body);
}

describe('POST /reviews', () => {
  it('lets a customer review a meal from a completed order', async () => {
    const kitchen = await openKitchen();
    const customer = await signUp(app);
    const orderId = await completedOrder(kitchen, customer.accessToken);

    const res = await review(customer.accessToken, { orderId, mealId: kitchen.mealId, rating: 5, comment: 'Best tamales in town!' });

    expect(res.status).toBe(201);
    expect(res.body.data.review).toMatchObject({
      rating: 5,
      comment: 'Best tamales in town!',
      customerName: 'Sam R.',
      meal: { id: kitchen.mealId, name: 'Tamales' },
      chefResponse: null,
    });
  });

  it("updates the meal's and the chef's average rating", async () => {
    const kitchen = await openKitchen();
    const first = await signUp(app);
    const second = await signUp(app);
    await review(first.accessToken, { orderId: await completedOrder(kitchen, first.accessToken), mealId: kitchen.mealId, rating: 5 });
    await review(second.accessToken, { orderId: await completedOrder(kitchen, second.accessToken), mealId: kitchen.mealId, rating: 4 });

    const chef = await request(app).get(`${API}/chefs/${kitchen.chefId}`);
    const meal = await request(app).get(`${API}/meals/${kitchen.mealId}`);

    expect(chef.body.data.chef).toMatchObject({ averageRating: 4.5, totalReviews: 2 });
    expect(meal.body.data.meal).toMatchObject({ averageRating: 4.5, totalReviews: 2 });
  });

  it('only accepts reviews once the order is completed', async () => {
    const kitchen = await openKitchen();
    const customer = await signUp(app);
    const placed = await placeOrder(customer.accessToken, pickupOrder(kitchen));

    const res = await review(customer.accessToken, { orderId: placed.body.data.order.id, mealId: kitchen.mealId, rating: 5 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ORDER_NOT_COMPLETED');
  });

  it("does not let someone review another customer's order", async () => {
    const kitchen = await openKitchen();
    const customer = await signUp(app);
    const stranger = await signUp(app);
    const orderId = await completedOrder(kitchen, customer.accessToken);

    const res = await review(stranger.accessToken, { orderId, mealId: kitchen.mealId, rating: 1 });

    expect(res.status).toBe(404);
  });

  it('only accepts meals that were in the order', async () => {
    const kitchen = await openKitchen();
    const otherMealId = await addMeal(kitchen.accessToken, { name: 'Pozole' });
    const customer = await signUp(app);
    const orderId = await completedOrder(kitchen, customer.accessToken);

    const res = await review(customer.accessToken, { orderId, mealId: otherMealId, rating: 5 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MEAL_NOT_IN_ORDER');
  });

  it('allows one review per meal per order', async () => {
    const kitchen = await openKitchen();
    const customer = await signUp(app);
    const orderId = await completedOrder(kitchen, customer.accessToken);
    await review(customer.accessToken, { orderId, mealId: kitchen.mealId, rating: 5 });

    const res = await review(customer.accessToken, { orderId, mealId: kitchen.mealId, rating: 1 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_REVIEWED');
  });

  it('takes a whole-number rating from 1 to 5', async () => {
    const kitchen = await openKitchen();
    const customer = await signUp(app);
    const orderId = await completedOrder(kitchen, customer.accessToken);

    const tooHigh = await review(customer.accessToken, { orderId, mealId: kitchen.mealId, rating: 6 });
    const fraction = await review(customer.accessToken, { orderId, mealId: kitchen.mealId, rating: 4.5 });

    expect(tooHigh.status).toBe(422);
    expect(fraction.status).toBe(422);
  });

  it('shows the customer which meals of the order they have reviewed', async () => {
    const kitchen = await openKitchen();
    const customer = await signUp(app);
    const orderId = await completedOrder(kitchen, customer.accessToken);
    await review(customer.accessToken, { orderId, mealId: kitchen.mealId, rating: 4, comment: 'Tasty' });

    const res = await request(app).get(`${API}/orders/${orderId}`).set(bearer(customer.accessToken));

    expect(res.body.data.order).toMatchObject({
      canReview: true,
      reviews: [{ mealId: kitchen.mealId, rating: 4, comment: 'Tasty' }],
    });
  });
});

describe('Public reviews', () => {
  it("lists a chef's reviews, newest first, with the chef's reply", async () => {
    const kitchen = await openKitchen();
    const first = await signUp(app);
    const second = await signUp(app);
    const older = await review(first.accessToken, {
      orderId: await completedOrder(kitchen, first.accessToken),
      mealId: kitchen.mealId,
      rating: 4,
      comment: 'Good',
    });
    await review(second.accessToken, { orderId: await completedOrder(kitchen, second.accessToken), mealId: kitchen.mealId, rating: 5, comment: 'Great' });
    await request(app)
      .post(`${API}/chefs/me/reviews/${older.body.data.review.id}/response`)
      .set(bearer(kitchen.accessToken))
      .send({ response: 'Thank you for ordering!' });

    const res = await request(app).get(`${API}/chefs/${kitchen.chefId}/reviews`);

    expect(res.status).toBe(200);
    expect(res.body.data.map((item: { comment: string }) => item.comment)).toEqual(['Great', 'Good']);
    expect(res.body.data[1].chefResponse).toBe('Thank you for ordering!');
    expect(res.body.pagination).toMatchObject({ total: 2 });
  });

  it("lists a meal's reviews", async () => {
    const kitchen = await openKitchen();
    const otherMealId = await addMeal(kitchen.accessToken, { name: 'Pozole' });
    const customer = await signUp(app);
    const orderId = await completedOrder(kitchen, customer.accessToken, {
      items: [{ mealId: kitchen.mealId, quantity: 1 }, { mealId: otherMealId, quantity: 1 }],
    });
    await review(customer.accessToken, { orderId, mealId: kitchen.mealId, rating: 5, comment: 'Tamales were amazing' });
    await review(customer.accessToken, { orderId, mealId: otherMealId, rating: 3, comment: 'Pozole was a bit salty' });

    const res = await request(app).get(`${API}/meals/${otherMealId}/reviews`);

    expect(res.body.data.map((item: { comment: string }) => item.comment)).toEqual(['Pozole was a bit salty']);
  });
});

describe('Chefs replying to reviews', () => {
  it('lets the chef reply to a review of their kitchen', async () => {
    const kitchen = await openKitchen();
    const customer = await signUp(app);
    const created = await review(customer.accessToken, {
      orderId: await completedOrder(kitchen, customer.accessToken),
      mealId: kitchen.mealId,
      rating: 3,
    });

    const res = await request(app)
      .post(`${API}/chefs/me/reviews/${created.body.data.review.id}/response`)
      .set(bearer(kitchen.accessToken))
      .send({ response: 'Sorry it was late. Next one is on me!' });

    expect(res.status).toBe(200);
    expect(res.body.data.review.chefResponse).toBe('Sorry it was late. Next one is on me!');
    expect(res.body.data.review.chefRespondedAt).not.toBeNull();
  });

  it("cannot reply to reviews of another chef's kitchen", async () => {
    const kitchen = await openKitchen();
    const otherKitchen = await openKitchen();
    const customer = await signUp(app);
    const created = await review(customer.accessToken, {
      orderId: await completedOrder(kitchen, customer.accessToken),
      mealId: kitchen.mealId,
      rating: 3,
    });

    const res = await request(app)
      .post(`${API}/chefs/me/reviews/${created.body.data.review.id}/response`)
      .set(bearer(otherKitchen.accessToken))
      .send({ response: 'Not my review' });

    expect(res.status).toBe(404);
  });

  it("lists the chef's own reviews", async () => {
    const kitchen = await openKitchen();
    const customer = await signUp(app);
    await review(customer.accessToken, { orderId: await completedOrder(kitchen, customer.accessToken), mealId: kitchen.mealId, rating: 5 });

    const res = await request(app).get(`${API}/chefs/me/reviews`).set(bearer(kitchen.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('POST /reviews/:id/report', () => {
  it('records a report for a moderator to look at', async () => {
    const kitchen = await openKitchen();
    const customer = await signUp(app);
    const reader = await signUp(app);
    const created = await review(customer.accessToken, {
      orderId: await completedOrder(kitchen, customer.accessToken),
      mealId: kitchen.mealId,
      rating: 1,
      comment: 'Rude words here',
    });

    const res = await request(app)
      .post(`${API}/reviews/${created.body.data.review.id}/report`)
      .set(bearer(reader.accessToken))
      .send({ reason: 'Offensive language' });

    expect(res.status).toBe(200);
    const stored = await prisma.review.findUniqueOrThrow({ where: { id: created.body.data.review.id } });
    expect(stored).toMatchObject({ isFlagged: true, flagReason: 'Offensive language' });
  });
});
