import { DateTime } from 'luxon';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import {
  addMeal,
  API,
  bearer,
  daysFromNowAt,
  LA,
  openKitchen,
  pickupOrder,
  placeOrder,
  setOrderStatus as setStatus,
  signUp,
} from './helpers.js';

const app = createApp();

describe('POST /orders', () => {
  it('places a pickup pre-order priced from the menu, ignoring prices sent by the browser', async () => {
    const kitchen = await openKitchen();
    const customer = await signUp(app);
    const scheduledFor = daysFromNowAt(1, 18);

    const res = await placeOrder(customer.accessToken, {
      ...pickupOrder(kitchen, { scheduledFor }),
      items: [{ mealId: kitchen.mealId, quantity: 2, price: 0.01 }],
    });

    expect(res.status).toBe(201);
    const { order } = res.body.data;
    expect(order).toMatchObject({
      status: 'PENDING',
      pickupOrDelivery: 'PICKUP',
      scheduledFor,
      subtotal: 27,
      deliveryFee: 0,
      total: 27,
      items: [{ mealId: kitchen.mealId, mealName: 'Tamales', quantity: 2, priceAtPurchase: 13.5, lineTotal: 27 }],
      events: [{ status: 'PENDING' }],
    });
    expect(order.orderNumber).toMatch(/^NK-[A-Z0-9]{6}$/);
    expect(order).not.toHaveProperty('platformFee');
  });

  it('adds the delivery fee and keeps the delivery details for delivery orders', async () => {
    const kitchen = await openKitchen({ offersDelivery: true, deliveryFee: 4.5 });
    const customer = await signUp(app);

    const res = await placeOrder(customer.accessToken, {
      ...pickupOrder(kitchen),
      pickupOrDelivery: 'DELIVERY',
      deliveryAddress: '1 Orange St, Redlands, CA 92373',
      contactPhone: '(909) 555-0142',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.order).toMatchObject({
      subtotal: 27,
      deliveryFee: 4.5,
      total: 31.5,
      deliveryAddress: '1 Orange St, Redlands, CA 92373',
      contactPhone: '(909) 555-0142',
    });
  });

  it('needs an address and a phone number for delivery', async () => {
    const kitchen = await openKitchen({ offersDelivery: true });
    const customer = await signUp(app);

    const res = await placeOrder(customer.accessToken, { ...pickupOrder(kitchen), pickupOrDelivery: 'DELIVERY' });

    expect(res.status).toBe(422);
    expect(Object.keys(res.body.error.details).sort()).toEqual(['contactPhone', 'deliveryAddress']);
  });

  it('refuses delivery when the chef only offers pickup', async () => {
    const kitchen = await openKitchen({ offersDelivery: false });
    const customer = await signUp(app);

    const res = await placeOrder(customer.accessToken, {
      ...pickupOrder(kitchen),
      pickupOrDelivery: 'DELIVERY',
      deliveryAddress: '1 Orange St, Redlands, CA 92373',
      contactPhone: '9095550142',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DELIVERY_NOT_OFFERED');
  });

  // The exact lead-time and hours rules are covered in scheduling.test.ts.
  it('refuses times the chef has not offered', async () => {
    const kitchen = await openKitchen({ leadHours: 24 });
    const customer = await signUp(app);

    const tooSoon = await placeOrder(customer.accessToken, pickupOrder(kitchen, { scheduledFor: daysFromNowAt(0, 23) }));
    const afterHours = await placeOrder(customer.accessToken, pickupOrder(kitchen, { scheduledFor: daysFromNowAt(3, 22) }));

    expect(tooSoon.status).toBe(422);
    expect(tooSoon.body.error.code).toBe('INVALID_TIME');
    expect(afterHours.status).toBe(422);
  });

  it('refuses orders while the chef has paused new orders', async () => {
    const kitchen = await openKitchen();
    await request(app).put(`${API}/chefs/me`).set(bearer(kitchen.accessToken)).send({ isAcceptingOrders: false });
    const customer = await signUp(app);

    const res = await placeOrder(customer.accessToken, pickupOrder(kitchen));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NOT_ACCEPTING_ORDERS');
  });

  it("refuses hidden meals and meals from a different chef's kitchen", async () => {
    const kitchen = await openKitchen();
    const otherKitchen = await openKitchen();
    const hiddenMealId = await addMeal(kitchen.accessToken, { name: 'Secret menu', isAvailable: false });
    const customer = await signUp(app);

    const hidden = await placeOrder(customer.accessToken, pickupOrder(kitchen, { items: [{ mealId: hiddenMealId, quantity: 1 }] }));
    const mixed = await placeOrder(
      customer.accessToken,
      pickupOrder(kitchen, { items: [{ mealId: kitchen.mealId, quantity: 1 }, { mealId: otherKitchen.mealId, quantity: 1 }] }),
    );

    expect(hidden.status).toBe(409);
    expect(hidden.body.error.code).toBe('MEAL_UNAVAILABLE');
    expect(mixed.status).toBe(409);
    expect(mixed.body.error.code).toBe('MEAL_UNAVAILABLE');
    expect(await prisma.order.count()).toBe(0);
  });

  it("keeps to a meal's daily limit", async () => {
    const kitchen = await openKitchen();
    const limitedMealId = await addMeal(kitchen.accessToken, { name: 'Birria', maxOrdersPerDay: 3 });
    const first = await signUp(app);
    const second = await signUp(app);
    const order = (quantity: number, days = 1) =>
      pickupOrder(kitchen, { items: [{ mealId: limitedMealId, quantity }], scheduledFor: daysFromNowAt(days, 18) });

    expect((await placeOrder(first.accessToken, order(2))).status).toBe(201);
    const tooMany = await placeOrder(second.accessToken, order(2));
    const lastOne = await placeOrder(second.accessToken, order(1));
    const nextDay = await placeOrder(second.accessToken, order(3, 2));

    expect(tooMany.status).toBe(409);
    expect(tooMany.body.error.code).toBe('SOLD_OUT');
    expect(lastOne.status).toBe(201);
    expect(nextDay.status).toBe(201);
  });

  it('frees up the daily limit when an order is cancelled', async () => {
    const kitchen = await openKitchen();
    const limitedMealId = await addMeal(kitchen.accessToken, { name: 'Birria', maxOrdersPerDay: 3 });
    const first = await signUp(app);
    const second = await signUp(app);
    const order = pickupOrder(kitchen, { items: [{ mealId: limitedMealId, quantity: 3 }] });
    const placed = await placeOrder(first.accessToken, order);

    await request(app).post(`${API}/orders/${placed.body.data.order.id}/cancel`).set(bearer(first.accessToken)).send({ reason: 'Plans changed' });

    expect((await placeOrder(second.accessToken, order)).status).toBe(201);
  });

  it('does not let chefs order from their own kitchen', async () => {
    const kitchen = await openKitchen();

    const res = await placeOrder(kitchen.accessToken, pickupOrder(kitchen));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('OWN_KITCHEN');
  });

  it('requires login', async () => {
    const kitchen = await openKitchen();

    const res = await request(app).post(`${API}/orders`).send(pickupOrder(kitchen));

    expect(res.status).toBe(401);
  });
});

describe('Viewing orders as a customer', () => {
  it('lists only my own orders', async () => {
    const kitchen = await openKitchen();
    const me = await signUp(app);
    const someoneElse = await signUp(app);
    const mine = await placeOrder(me.accessToken, pickupOrder(kitchen));
    await placeOrder(someoneElse.accessToken, pickupOrder(kitchen));

    const res = await request(app).get(`${API}/orders`).set(bearer(me.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.map((order: { id: string }) => order.id)).toEqual([mine.body.data.order.id]);
  });

  it("shows the chef's pickup address only after the chef confirms", async () => {
    const kitchen = await openKitchen();
    const customer = await signUp(app);
    const placed = await placeOrder(customer.accessToken, pickupOrder(kitchen));
    const orderId = placed.body.data.order.id;

    const beforeConfirming = await request(app).get(`${API}/orders/${orderId}`).set(bearer(customer.accessToken));
    await setStatus(kitchen, orderId, 'CONFIRMED');
    const afterConfirming = await request(app).get(`${API}/orders/${orderId}`).set(bearer(customer.accessToken));

    expect(beforeConfirming.body.data.order.pickupAddress).toBeNull();
    expect(afterConfirming.body.data.order.pickupAddress).toBe('742 Evergreen Terrace, Redlands, CA 92373');
  });

  it("hides other customers' orders", async () => {
    const kitchen = await openKitchen();
    const owner = await signUp(app);
    const stranger = await signUp(app);
    const placed = await placeOrder(owner.accessToken, pickupOrder(kitchen));

    const res = await request(app).get(`${API}/orders/${placed.body.data.order.id}`).set(bearer(stranger.accessToken));

    expect(res.status).toBe(404);
  });
});

describe('Handling orders as a chef', () => {
  it('shows the orders, customer and payout to the chef', async () => {
    const kitchen = await openKitchen();
    const customer = await signUp(app);
    await placeOrder(customer.accessToken, pickupOrder(kitchen));

    const res = await request(app).get(`${API}/chefs/me/orders`).set(bearer(kitchen.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ customer: { name: 'Sam R.' }, total: 27, platformFee: 2.7, chefPayout: 24.3 });
  });

  it('moves an order through each step and records the history', async () => {
    const kitchen = await openKitchen();
    const customer = await signUp(app);
    const placed = await placeOrder(customer.accessToken, pickupOrder(kitchen));
    const orderId = placed.body.data.order.id;

    for (const status of ['CONFIRMED', 'PREPARING', 'READY', 'COMPLETED']) {
      const res = await setStatus(kitchen, orderId, status);
      expect(res.status).toBe(200);
    }

    const order = await request(app).get(`${API}/orders/${orderId}`).set(bearer(customer.accessToken));
    expect(order.body.data.order.status).toBe('COMPLETED');
    expect(order.body.data.order.completedAt).not.toBeNull();
    expect(order.body.data.order.events.map((event: { status: string }) => event.status)).toEqual([
      'PENDING',
      'CONFIRMED',
      'PREPARING',
      'READY',
      'COMPLETED',
    ]);
    const chef = await prisma.chefProfile.findUniqueOrThrow({ where: { id: kitchen.chefId } });
    const meal = await prisma.meal.findUniqueOrThrow({ where: { id: kitchen.mealId } });
    expect(chef.totalOrders).toBe(1);
    expect(meal.totalOrders).toBe(1);
  });

  it('does not allow skipping steps', async () => {
    const kitchen = await openKitchen();
    const customer = await signUp(app);
    const placed = await placeOrder(customer.accessToken, pickupOrder(kitchen));

    const res = await setStatus(kitchen, placed.body.data.order.id, 'READY');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATUS_CHANGE');
  });

  it("cannot update another chef's order", async () => {
    const kitchen = await openKitchen();
    const otherKitchen = await openKitchen();
    const customer = await signUp(app);
    const placed = await placeOrder(customer.accessToken, pickupOrder(kitchen));

    const res = await setStatus(otherKitchen, placed.body.data.order.id, 'CONFIRMED');

    expect(res.status).toBe(404);
  });

  it('lets the chef decline an order with a reason', async () => {
    const kitchen = await openKitchen();
    const customer = await signUp(app);
    const placed = await placeOrder(customer.accessToken, pickupOrder(kitchen));

    const res = await request(app)
      .post(`${API}/chefs/me/orders/${placed.body.data.order.id}/cancel`)
      .set(bearer(kitchen.accessToken))
      .send({ reason: 'Ran out of masa' });

    expect(res.status).toBe(200);
    expect(res.body.data.order).toMatchObject({ status: 'CANCELLED', cancellationReason: 'Ran out of masa' });
  });
});

describe('Cancelling as a customer', () => {
  it('cancels an order that has not been started', async () => {
    const kitchen = await openKitchen();
    const customer = await signUp(app);
    const placed = await placeOrder(customer.accessToken, pickupOrder(kitchen));

    const res = await request(app)
      .post(`${API}/orders/${placed.body.data.order.id}/cancel`)
      .set(bearer(customer.accessToken))
      .send({ reason: 'Plans changed' });

    expect(res.status).toBe(200);
    expect(res.body.data.order).toMatchObject({ status: 'CANCELLED', cancellationReason: 'Plans changed', canCancel: false });
  });

  it('cannot cancel once the chef has started cooking', async () => {
    const kitchen = await openKitchen();
    const customer = await signUp(app);
    const placed = await placeOrder(customer.accessToken, pickupOrder(kitchen));
    const orderId = placed.body.data.order.id;
    await setStatus(kitchen, orderId, 'CONFIRMED');
    await setStatus(kitchen, orderId, 'PREPARING');

    const res = await request(app).post(`${API}/orders/${orderId}/cancel`).set(bearer(customer.accessToken)).send({});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CANNOT_CANCEL');
  });
});

describe('GET /chefs/:id/order-slots', () => {
  it("lists the pickup times customers can choose, in the chef's time zone", async () => {
    const kitchen = await openKitchen();

    const res = await request(app).get(`${API}/chefs/${kitchen.chefId}/order-slots`);

    expect(res.status).toBe(200);
    expect(res.body.data.timezone).toBe(LA);
    expect(res.body.data.days.length).toBeGreaterThanOrEqual(14);
    const tomorrow = DateTime.now().setZone(LA).plus({ days: 1 }).toISODate();
    const tomorrowSlots = res.body.data.days.find((day: { date: string }) => day.date === tomorrow).slots;
    expect(tomorrowSlots[0]).toBe(daysFromNowAt(1, 8));
    expect(tomorrowSlots).toHaveLength(26); // every half hour from 8:00 AM to 8:30 PM
  });
});
