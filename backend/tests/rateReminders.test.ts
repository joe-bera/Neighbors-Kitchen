import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { sendRateReminders } from '../src/services/reviewService.js';
import { API, bearer, completedOrder, openKitchen, signUp } from './helpers.js';
import { bellFor, emailsFor } from './notificationHelpers.js';

const app = createApp();
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const threeHoursFromNow = () => new Date(Date.now() + 3 * HOUR);

async function finishedOrder() {
  const kitchen = await openKitchen();
  const customer = await signUp(app);
  const orderId = await completedOrder(kitchen, customer.accessToken);
  return { kitchen, customer, orderId };
}

const reminders = async (userId: string) => (await bellFor(userId)).filter((notice) => notice.kind === 'RATE_REMINDER');
const reminderEmails = async (userId: string) => (await emailsFor(userId)).filter((email) => email.kind === 'RATE_REMINDER');

describe('Rate-your-meal reminders', () => {
  it('are scheduled 120 minutes after the order is completed', async () => {
    const { orderId } = await finishedOrder();

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });

    expect(order.rateReminderAt!.getTime() - order.completedAt!.getTime()).toBe(120 * MINUTE);
  });

  it('remind the customer once the time comes, when a meal is not rated yet', async () => {
    const { customer, orderId } = await finishedOrder();

    expect(await sendRateReminders(threeHoursFromNow())).toBe(1);

    expect(await reminders(customer.userId)).toEqual([
      { kind: 'RATE_REMINDER', title: "How was your meal from Sam's Kitchen?", body: 'Tap to rate your meals', link: `/orders/${orderId}` },
    ]);
    expect(await reminderEmails(customer.userId)).toHaveLength(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).rateReminderAt).toBeNull();
  });

  it('wait until they are due', async () => {
    const { customer } = await finishedOrder();

    expect(await sendRateReminders(new Date())).toBe(0);

    expect(await reminders(customer.userId)).toEqual([]);
  });

  it('are skipped when every meal is already rated', async () => {
    const { kitchen, customer, orderId } = await finishedOrder();
    await request(app).post(`${API}/reviews`).set(bearer(customer.accessToken)).send({ orderId, mealId: kitchen.mealId, rating: 4 });

    expect(await sendRateReminders(threeHoursFromNow())).toBe(0);

    expect(await reminders(customer.userId)).toEqual([]);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).rateReminderAt).toBeNull();
  });

  it('come only once', async () => {
    const { customer } = await finishedOrder();

    expect(await sendRateReminders(threeHoursFromNow())).toBe(1);
    expect(await sendRateReminders(threeHoursFromNow())).toBe(0);

    expect(await reminders(customer.userId)).toHaveLength(1);
  });

  it("ring the bell but send no email when the customer turned them off", async () => {
    const { customer } = await finishedOrder();
    await prisma.user.update({ where: { id: customer.userId }, data: { emailRateReminders: false } });

    await sendRateReminders(threeHoursFromNow());

    expect(await reminders(customer.userId)).toHaveLength(1);
    expect(await reminderEmails(customer.userId)).toEqual([]);
  });
});
