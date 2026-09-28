import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { confirmationTimes } from '../src/services/orderService.js';
import { API, availabilityInput, bearer, type Kitchen, openKitchen, pickupOrder, placeOrder, signUp } from './helpers.js';
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
