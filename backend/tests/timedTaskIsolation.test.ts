import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { expireOverdueOrders, sendChefReminders } from '../src/services/orderService.js';
import { sendRateReminders } from '../src/services/reviewService.js';
import { completedOrder, openKitchen, pickupOrder, placeOrder, signUp } from './helpers.js';
import { bellFor } from './notificationHelpers.js';

const app = createApp();
const MINUTE = 60 * 1000;

// Notices about one chosen order fail, as if something about that order always broke.
const breaking = vi.hoisted(() => ({ orderId: null as string | null }));
vi.mock('../src/services/notifications/notify.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/notifications/notify.js')>();
  return {
    ...actual,
    notify: async (...args: Parameters<typeof actual.notify>) => {
      if (breaking.orderId && (args[3] as { orderId?: string }).orderId === breaking.orderId) throw new Error('this order always breaks');
      return actual.notify(...args);
    },
  };
});

afterEach(() => {
  breaking.orderId = null;
  vi.restoreAllMocks();
});

async function twoWaitingOrders() {
  const kitchen = await openKitchen();
  const customer = await signUp(app);
  const [first, second] = [await placeOrder(customer.accessToken, pickupOrder(kitchen)), await placeOrder(customer.accessToken, pickupOrder(kitchen))];
  expect([first.status, second.status]).toEqual([201, 201]);
  return { kitchen, customer, bad: first.body.data.order.id as string, good: second.body.data.order.id as string };
}

const logged = () => vi.spyOn(console, 'error').mockImplementation(() => {});
const statusOf = async (id: string) => (await prisma.order.findUniqueOrThrow({ where: { id } })).status;

describe('One order that always fails', () => {
  it('does not stop the other orders from being cancelled at their deadline', async () => {
    const { bad, good } = await twoWaitingOrders();
    await prisma.order.update({ where: { id: bad }, data: { confirmBy: new Date(Date.now() - 2 * MINUTE) } });
    await prisma.order.update({ where: { id: good }, data: { confirmBy: new Date(Date.now() - MINUTE) } });
    breaking.orderId = bad;
    const errors = logged();

    expect(await expireOverdueOrders()).toBe(1);

    expect([await statusOf(bad), await statusOf(good)]).toEqual(['PENDING', 'CANCELLED']);
    expect(errors.mock.calls.flat().join(' ')).toContain(bad);
  });

  it('does not stop the other chefs from being reminded', async () => {
    const { kitchen, bad, good } = await twoWaitingOrders();
    await prisma.order.update({ where: { id: bad }, data: { chefReminderAt: new Date(Date.now() - 2 * MINUTE) } });
    await prisma.order.update({ where: { id: good }, data: { chefReminderAt: new Date(Date.now() - MINUTE) } });
    breaking.orderId = bad;
    const errors = logged();

    expect(await sendChefReminders()).toBe(1);

    expect((await bellFor(kitchen.userId)).filter((notice) => notice.kind === 'CONFIRM_REMINDER')).toHaveLength(1);
    expect(errors.mock.calls.flat().join(' ')).toContain(bad);
  });

  it('does not stop the other rate-your-meal reminders', async () => {
    const kitchen = await openKitchen();
    const customer = await signUp(app);
    const bad = await completedOrder(kitchen, customer.accessToken);
    const good = await completedOrder(kitchen, customer.accessToken);
    await prisma.order.update({ where: { id: bad }, data: { rateReminderAt: new Date(Date.now() - 2 * MINUTE) } });
    await prisma.order.update({ where: { id: good }, data: { rateReminderAt: new Date(Date.now() - MINUTE) } });
    breaking.orderId = bad;
    const errors = logged();

    expect(await sendRateReminders()).toBe(1);

    expect((await bellFor(customer.userId)).filter((notice) => notice.kind === 'RATE_REMINDER')).toEqual([
      expect.objectContaining({ link: `/orders/${good}` }),
    ]);
    expect(errors.mock.calls.flat().join(' ')).toContain(bad);
  });
});
