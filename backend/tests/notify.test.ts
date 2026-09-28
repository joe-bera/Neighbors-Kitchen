import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { notify, recipientSelect } from '../src/services/notifications/notify.js';
import { orderNoticeData } from '../src/services/notifications/orderNotices.js';
import { bellFor, emailsFor } from './notificationHelpers.js';
import { sampleOrder } from './noticeFixtures.js';

let sequence = 0;

function person(overrides: Partial<Prisma.UserCreateInput> = {}) {
  sequence += 1;
  return prisma.user.create({
    data: { email: `dana${sequence}@example.com`, passwordHash: 'not-a-real-hash', firstName: 'Dana', lastName: 'Kim', ...overrides },
    select: recipientSelect,
  });
}

describe('notify', () => {
  it('puts a notice under the bell and queues its email', async () => {
    const dana = await person();

    await notify(prisma, dana, 'ORDER_CONFIRMED', sampleOrder);

    expect(await bellFor(dana.id)).toEqual([
      { kind: 'ORDER_CONFIRMED', title: "Abuela's Table confirmed your order", body: 'NK-7QX4PD · Tue, Sep 29 at 6:00 PM', link: '/orders/order-1' },
    ]);
    expect(await emailsFor(dana.id)).toEqual([{ kind: 'ORDER_CONFIRMED', toAddress: dana.email, data: sampleOrder, status: 'PENDING' }]);
  });

  it('only emails a receipt', async () => {
    const dana = await person();

    await notify(prisma, dana, 'ORDER_PLACED', sampleOrder);

    expect(await bellFor(dana.id)).toEqual([]);
    expect((await emailsFor(dana.id)).map((email) => email.kind)).toEqual(['ORDER_PLACED']);
  });

  it('only rings the bell for "started cooking"', async () => {
    const dana = await person();

    await notify(prisma, dana, 'ORDER_PREPARING', sampleOrder);

    expect((await bellFor(dana.id)).map((notice) => notice.kind)).toEqual(['ORDER_PREPARING']);
    expect(await emailsFor(dana.id)).toEqual([]);
  });

  it('skips only the emails a person switched off', async () => {
    const dana = await person({ emailRateReminders: false });

    await notify(prisma, dana, 'RATE_REMINDER', sampleOrder);
    await notify(prisma, dana, 'ORDER_READY', sampleOrder);

    expect((await bellFor(dana.id)).map((notice) => notice.kind)).toEqual(['ORDER_READY', 'RATE_REMINDER']);
    expect((await emailsFor(dana.id)).map((email) => email.kind)).toEqual(['ORDER_READY']);
  });

  it('sends nothing to a deactivated account', async () => {
    const dana = await person({ isActive: false });

    await notify(prisma, dana, 'ORDER_CONFIRMED', sampleOrder);

    expect(await bellFor(dana.id)).toEqual([]);
    expect(await emailsFor(dana.id)).toEqual([]);
  });

  it('is part of the change that caused it: nothing is left when that change fails', async () => {
    const dana = await person();

    const change = prisma.$transaction(async (tx) => {
      await notify(tx, dana, 'ORDER_CONFIRMED', sampleOrder);
      throw new Error('the order change failed');
    });

    await expect(change).rejects.toThrow('the order change failed');
    expect(await prisma.notification.count()).toBe(0);
    expect(await prisma.email.count()).toBe(0);
  });
});

describe('orderNoticeData', () => {
  it('takes a snapshot of the order with display names and money as numbers', () => {
    const order = {
      id: 'order-1',
      orderNumber: 'NK-7QX4PD',
      chefId: 'chef-1',
      customerId: 'customer-1',
      scheduledFor: new Date('2026-09-30T01:00:00.000Z'),
      pickupOrDelivery: 'DELIVERY' as const,
      total: new Prisma.Decimal('33.00'),
      platformFee: new Prisma.Decimal('3.30'),
      cancellationReason: null,
      orderItems: [{ mealName: 'Churros', quantity: 1 }],
      chef: { userId: 'chef-user', kitchenName: null, timezone: 'America/Los_Angeles', user: { firstName: 'Maria' } },
      customer: { firstName: 'Dana', lastName: 'Kim' },
    };

    expect(orderNoticeData(order, { declined: true, reason: 'Out of masa' })).toEqual({
      orderId: 'order-1',
      orderNumber: 'NK-7QX4PD',
      chefId: 'chef-1',
      kitchenName: "Maria's Kitchen",
      customerName: 'Dana K.',
      items: [{ name: 'Churros', quantity: 1 }],
      scheduledFor: '2026-09-30T01:00:00.000Z',
      timezone: 'America/Los_Angeles',
      pickupOrDelivery: 'DELIVERY',
      total: 33,
      chefPayout: 29.7,
      confirmBy: null,
      reason: 'Out of masa',
      declined: true,
    });
  });
});
