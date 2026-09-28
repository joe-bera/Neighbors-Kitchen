import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { confirmationTimes, expireOverdueOrders, sendChefReminders } from '../src/services/orderService.js';
import { API, availabilityInput, bearer, type Kitchen, openKitchen, pickupOrder, placeOrder, setOrderStatus, signUp } from './helpers.js';
import { bellFor, emailsFor } from './notificationHelpers.js';

const app = createApp();

const saveHours = (kitchen: Kitchen, overrides: Record<string, unknown> = {}) =>
  request(app).put(`${API}/chefs/me/availability`).set(bearer(kitchen.accessToken)).send(availabilityInput(overrides));
const publicProfile = (kitchen: Kitchen) => request(app).get(`${API}/chefs/${kitchen.chefId}`);
const ownKitchen = (kitchen: Kitchen) => request(app).get(`${API}/chefs/me`).set(bearer(kitchen.accessToken));

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

describe('The confirm-time promise', () => {
  it('is 4 hours for a new kitchen, and customers see the one the chef picks', async () => {
    const kitchen = await openKitchen();
    expect((await publicProfile(kitchen)).body.data.chef.confirmWithinHours).toBe(4);

    const saved = await saveHours(kitchen, { confirmWithinHours: 12 });

    expect(saved.status).toBe(200);
    expect(saved.body.data.chefProfile.confirmWithinHours).toBe(12);
    expect((await publicProfile(kitchen)).body.data.chef.confirmWithinHours).toBe(12);
  });

  it('stays the same when the hours are saved without it', async () => {
    const kitchen = await openKitchen({ confirmWithinHours: 12 });

    await saveHours(kitchen);

    expect((await ownKitchen(kitchen)).body.data.chefProfile.confirmWithinHours).toBe(12);
  });

  it('can only be 1, 4, 12 or 24 hours', async () => {
    const kitchen = await openKitchen();

    const res = await saveHours(kitchen, { confirmWithinHours: 5 });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toEqual({ confirmWithinHours: 'Choose 1, 4, 12 or 24 hours' });
  });
});

describe('confirmationTimes', () => {
  it("gives the chef their promised hours, with a reminder halfway", () => {
    expect(confirmationTimes(new Date('2026-09-29T10:00:00.000Z'), new Date('2026-09-30T01:00:00.000Z'), 4)).toEqual({
      confirmBy: new Date('2026-09-29T14:00:00.000Z'),
      chefReminderAt: new Date('2026-09-29T12:00:00.000Z'),
    });
  });

  it('ends at the pickup time when that comes first', () => {
    expect(confirmationTimes(new Date('2026-09-29T10:00:00.000Z'), new Date('2026-09-30T01:00:00.000Z'), 24)).toEqual({
      confirmBy: new Date('2026-09-30T01:00:00.000Z'),
      chefReminderAt: new Date('2026-09-29T17:30:00.000Z'),
    });
  });
});

describe('Deadlines on new orders', () => {
  it('give the chef their promised time, with a reminder halfway', async () => {
    const kitchen = await openKitchen({ confirmWithinHours: 1 });
    const customer = await signUp(app);
    const before = Date.now();

    // Tomorrow at 6 PM: always more than an hour away.
    const res = await placeOrder(customer.accessToken, pickupOrder(kitchen));

    expect(res.status).toBe(201);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: res.body.data.order.id } });
    expect(order.confirmBy!.getTime()).toBeGreaterThanOrEqual(before + HOUR);
    expect(order.confirmBy!.getTime()).toBeLessThanOrEqual(Date.now() + HOUR);
    expect(order.chefReminderAt!.getTime()).toBe(order.confirmBy!.getTime() - 30 * MINUTE);
    expect(res.body.data.order.confirmBy).toBe(order.confirmBy!.toISOString());
  });

  it('end at the pickup time when that comes before the promise', async () => {
    const kitchen = await openKitchen({ confirmWithinHours: 24 });
    const customer = await signUp(app);
    const slots = await request(app).get(`${API}/chefs/${kitchen.chefId}/order-slots`);
    // Open 8 AM to 9 PM with a one-hour lead time, so the first slot is always less than 24 hours away.
    const firstSlot = slots.body.data.days[0].slots[0] as string;

    const res = await placeOrder(customer.accessToken, pickupOrder(kitchen, { scheduledFor: firstSlot }));

    expect(res.status).toBe(201);
    expect(new Date(res.body.data.order.confirmBy).getTime()).toBe(new Date(firstSlot).getTime());
  });

  it('show the chef the deadline in the new-order notice', async () => {
    const kitchen = await openKitchen();
    const customer = await signUp(app);

    const res = await placeOrder(customer.accessToken, pickupOrder(kitchen));

    const [notice] = await bellFor(kitchen.userId);
    expect(notice.body).toContain(' · Confirm by ');
    const [email] = await emailsFor(kitchen.userId);
    expect((email.data as { confirmBy: string }).confirmBy).toBe(res.body.data.order.confirmBy);
  });

  it('keep their deadline when the chef later changes the promise', async () => {
    const kitchen = await openKitchen({ confirmWithinHours: 4 });
    const customer = await signUp(app);
    const res = await placeOrder(customer.accessToken, pickupOrder(kitchen));
    const placed = await prisma.order.findUniqueOrThrow({ where: { id: res.body.data.order.id } });
    expect(placed.confirmBy).not.toBeNull();

    await saveHours(kitchen, { confirmWithinHours: 24 });

    const later = await prisma.order.findUniqueOrThrow({ where: { id: placed.id } });
    expect(later.confirmBy).toEqual(placed.confirmBy);
    expect(later.chefReminderAt).toEqual(placed.chefReminderAt);
  });
});

describe('Reminders and automatic cancellation', () => {
  async function waitingOrder() {
    const kitchen = await openKitchen();
    const customer = await signUp(app, 'CUSTOMER', { firstName: 'Dana', lastName: 'Kim' });
    const res = await placeOrder(customer.accessToken, pickupOrder(kitchen));
    expect(res.status).toBe(201);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: res.body.data.order.id } });
    return { kitchen, customer, order };
  }
  const minuteBefore = (date: Date) => new Date(date.getTime() - MINUTE);
  const minuteAfter = (date: Date) => new Date(date.getTime() + MINUTE);

  it('remind the chef once, halfway to the deadline', async () => {
    const { kitchen, order } = await waitingOrder();

    expect(await sendChefReminders(minuteBefore(order.chefReminderAt!))).toBe(0);
    expect(await sendChefReminders(minuteAfter(order.chefReminderAt!))).toBe(1);
    expect(await sendChefReminders(minuteAfter(order.chefReminderAt!))).toBe(0);

    expect((await bellFor(kitchen.userId)).filter((notice) => notice.kind === 'CONFIRM_REMINDER')).toEqual([
      {
        kind: 'CONFIRM_REMINDER',
        title: `Order ${order.orderNumber} still needs your confirmation`,
        body: expect.stringMatching(/^Confirm by .+ or it will be cancelled automatically$/),
        link: '/chef/orders',
      },
    ]);
    expect((await emailsFor(kitchen.userId)).filter((email) => email.kind === 'CONFIRM_REMINDER')).toHaveLength(1);
  });

  it('leave orders alone once the chef has confirmed them', async () => {
    const { kitchen, order } = await waitingOrder();
    await setOrderStatus(kitchen, order.id, 'CONFIRMED');

    expect(await sendChefReminders(minuteAfter(order.confirmBy!))).toBe(0);
    expect(await expireOverdueOrders(minuteAfter(order.confirmBy!))).toBe(0);
  });

  it('cancel an order still waiting at its deadline, and tell both sides', async () => {
    const { kitchen, customer, order } = await waitingOrder();

    expect(await expireOverdueOrders(minuteBefore(order.confirmBy!))).toBe(0);
    expect(await expireOverdueOrders(minuteAfter(order.confirmBy!))).toBe(1);

    const reason = "Sam's Kitchen didn't confirm this order in time.";
    const cancelled = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { events: { orderBy: { createdAt: 'asc' } } } });
    expect(cancelled).toMatchObject({ status: 'CANCELLED', cancellationReason: reason });
    expect(cancelled.events.at(-1)).toMatchObject({ status: 'CANCELLED', note: reason });
    expect(await bellFor(customer.userId)).toEqual([
      { kind: 'ORDER_EXPIRED', title: 'Your order was cancelled', body: `Sam's Kitchen didn't confirm ${order.orderNumber} in time`, link: `/orders/${order.id}` },
    ]);
    expect((await bellFor(kitchen.userId)).map((notice) => notice.kind)).toEqual(['NEW_ORDER', 'CHEF_ORDER_EXPIRED']);
    expect((await emailsFor(customer.userId)).map((email) => email.kind)).toEqual(['ORDER_PLACED', 'ORDER_EXPIRED']);
    expect((await emailsFor(kitchen.userId)).map((email) => email.kind)).toEqual(['NEW_ORDER', 'CHEF_ORDER_EXPIRED']);
  });

  it('tell a chef who confirms too late that the order was cancelled', async () => {
    const { kitchen, order } = await waitingOrder();
    await expireOverdueOrders(minuteAfter(order.confirmBy!));

    const res = await setOrderStatus(kitchen, order.id, 'CONFIRMED');

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('This order is cancelled, so it cannot be marked confirmed.');
  });

  it('never touch orders placed before deadlines existed', async () => {
    const { order } = await waitingOrder();
    await prisma.order.update({ where: { id: order.id }, data: { confirmBy: null, chefReminderAt: null } });
    const muchLater = new Date(Date.now() + 30 * 24 * HOUR);

    expect(await sendChefReminders(muchLater)).toBe(0);
    expect(await expireOverdueOrders(muchLater)).toBe(0);
  });

  it('act only once when two helpers run at the same time', async () => {
    const { customer, order } = await waitingOrder();

    const results = await Promise.all([expireOverdueOrders(minuteAfter(order.confirmBy!)), expireOverdueOrders(minuteAfter(order.confirmBy!))]);

    expect(results[0] + results[1]).toBe(1);
    expect((await bellFor(customer.userId)).filter((notice) => notice.kind === 'ORDER_EXPIRED')).toHaveLength(1);
  });
});
