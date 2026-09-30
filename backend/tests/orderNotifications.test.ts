import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { API, bearer, type Kitchen, openKitchen, pickupOrder, placeOrder, setOrderStatus, signUp } from './helpers.js';
import { bellFor, emailsFor } from './notificationHelpers.js';

const app = createApp();

type Person = Awaited<ReturnType<typeof signUp>>;

// Test chefs are Sam Rivera of "Sam's Kitchen"; the customer is Dana Kim, so notices can tell them apart.
const signUpDana = () => signUp(app, 'CUSTOMER', { firstName: 'Dana', lastName: 'Kim' });

async function placedOrder(kitchen: Kitchen, customer: { accessToken: string }, overrides: Record<string, unknown> = {}) {
  const res = await placeOrder(customer.accessToken, pickupOrder(kitchen, overrides));
  expect(res.status).toBe(201);
  return res.body.data.order as { id: string; orderNumber: string };
}

function cancelAsCustomer(customer: Person, orderId: string, reason?: string) {
  return request(app).post(`${API}/orders/${orderId}/cancel`).set(bearer(customer.accessToken)).send({ reason });
}

function cancelAsChef(kitchen: Kitchen, orderId: string, reason?: string) {
  return request(app).post(`${API}/chefs/me/orders/${orderId}/cancel`).set(bearer(kitchen.accessToken)).send({ reason });
}

describe('New orders', () => {
  it('ring the chef\'s bell, email the chef, and send the customer a receipt', async () => {
    const kitchen = await openKitchen();
    const customer = await signUpDana();

    const order = await placedOrder(kitchen, customer);

    const chefBell = await bellFor(kitchen.userId);
    expect(chefBell).toHaveLength(1);
    expect(chefBell[0]).toMatchObject({ kind: 'NEW_ORDER', title: 'New order from Dana K.', link: '/chef/orders' });
    expect(chefBell[0].body?.startsWith(`${order.orderNumber} · `)).toBe(true);
    expect((await emailsFor(kitchen.userId)).map((email) => email.kind)).toEqual(['NEW_ORDER']);

    const receipts = await emailsFor(customer.userId);
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({
      kind: 'ORDER_PLACED',
      toAddress: customer.email,
      status: 'PENDING',
      data: {
        orderNumber: order.orderNumber,
        kitchenName: "Sam's Kitchen",
        customerName: 'Dana K.',
        items: [{ name: 'Tamales', quantity: 2 }],
        total: 27,
        chefPayout: 24.3,
      },
    });
    expect(await bellFor(customer.userId)).toEqual([]);
  });

  it('keep addresses and phone numbers out of every notice', async () => {
    const kitchen = await openKitchen({ offersDelivery: true });
    const customer = await signUpDana();

    await placedOrder(kitchen, customer, {
      pickupOrDelivery: 'DELIVERY',
      deliveryAddress: '1 Orange St, Redlands, CA 92373',
      contactPhone: '(909) 555-0142',
    });

    const notices = [await bellFor(kitchen.userId), await emailsFor(kitchen.userId), await emailsFor(customer.userId)];
    expect(notices.map((rows) => rows.length)).toEqual([1, 1, 1]);
    const everything = JSON.stringify(notices);
    expect(everything).not.toContain('Orange St');
    expect(everything).not.toContain('555-0142');
    expect(everything).not.toContain('Evergreen');
  });

  it('create nothing when the order is refused', async () => {
    const kitchen = await openKitchen();
    const customer = await signUpDana();

    const res = await placeOrder(customer.accessToken, pickupOrder(kitchen, { scheduledFor: '2020-01-01T01:00:00.000Z' }));

    expect(res.status).toBe(422);
    expect(await prisma.notification.count()).toBe(0);
    expect(await prisma.email.count()).toBe(0);
  });

  it('treat a chef who orders from another kitchen as a customer', async () => {
    const kitchen = await openKitchen();
    const otherChef = await openKitchen();

    await placedOrder(kitchen, otherChef);

    expect((await emailsFor(otherChef.userId)).map((email) => email.kind)).toEqual(['ORDER_PLACED']);
    expect((await bellFor(kitchen.userId)).map((notice) => notice.kind)).toEqual(['NEW_ORDER']);
  });

  it('work for a customer whose surname starts with a rare character', async () => {
    const kitchen = await openKitchen();
    const customer = await signUp(app, 'CUSTOMER', { firstName: 'Dana', lastName: '𠮷田' });

    const res = await placeOrder(customer.accessToken, pickupOrder(kitchen));

    expect(res.status).toBe(201);
    expect((await bellFor(kitchen.userId))[0]).toMatchObject({ kind: 'NEW_ORDER', title: 'New order from Dana 𠮷.' });
  });
});

describe('Chef updates', () => {
  it('tell the customer when the order is confirmed, being cooked and ready, emailing only confirmed and ready', async () => {
    const kitchen = await openKitchen();
    const customer = await signUpDana();
    const order = await placedOrder(kitchen, customer);

    for (const status of ['CONFIRMED', 'PREPARING', 'READY']) {
      expect((await setOrderStatus(kitchen, order.id, status)).status).toBe(200);
    }

    expect(await bellFor(customer.userId)).toEqual([
      { kind: 'ORDER_CONFIRMED', title: "Sam's Kitchen confirmed your order", body: expect.stringContaining(order.orderNumber), link: `/orders/${order.id}` },
      { kind: 'ORDER_PREPARING', title: "Sam's Kitchen started cooking your order", body: order.orderNumber, link: `/orders/${order.id}` },
      { kind: 'ORDER_READY', title: 'Your order is ready for pickup', body: `${order.orderNumber} from Sam's Kitchen`, link: `/orders/${order.id}` },
    ]);
    expect((await emailsFor(customer.userId)).map((email) => email.kind)).toEqual(['ORDER_PLACED', 'ORDER_CONFIRMED', 'ORDER_READY']);
  });

  it('send nothing when the order is completed', async () => {
    const kitchen = await openKitchen();
    const customer = await signUpDana();
    const order = await placedOrder(kitchen, customer);
    for (const status of ['CONFIRMED', 'PREPARING', 'READY']) await setOrderStatus(kitchen, order.id, status);

    expect((await setOrderStatus(kitchen, order.id, 'COMPLETED')).status).toBe(200);

    expect(await bellFor(customer.userId)).toHaveLength(3);
    expect(await emailsFor(customer.userId)).toHaveLength(3);
  });

  it('create nothing for a step that is not allowed', async () => {
    const kitchen = await openKitchen();
    const customer = await signUpDana();
    const order = await placedOrder(kitchen, customer);

    expect((await setOrderStatus(kitchen, order.id, 'READY')).status).toBe(409);

    expect(await bellFor(customer.userId)).toEqual([]);
    expect((await emailsFor(customer.userId)).map((email) => email.kind)).toEqual(['ORDER_PLACED']);
  });
});

describe('Cancellations', () => {
  it('say the chef declined a waiting order, with the reason', async () => {
    const kitchen = await openKitchen();
    const customer = await signUpDana();
    const order = await placedOrder(kitchen, customer);

    expect((await cancelAsChef(kitchen, order.id, 'Out of masa today')).status).toBe(200);

    expect(await bellFor(customer.userId)).toEqual([
      { kind: 'ORDER_CANCELLED_BY_CHEF', title: "Sam's Kitchen declined your order", body: 'Out of masa today', link: `/orders/${order.id}` },
    ]);
    const emails = await emailsFor(customer.userId);
    expect(emails.map((email) => email.kind)).toEqual(['ORDER_PLACED', 'ORDER_CANCELLED_BY_CHEF']);
    expect(emails[1].data).toMatchObject({ declined: true, reason: 'Out of masa today' });
  });

  it('say the chef cancelled an order that was already confirmed', async () => {
    const kitchen = await openKitchen();
    const customer = await signUpDana();
    const order = await placedOrder(kitchen, customer);
    await setOrderStatus(kitchen, order.id, 'CONFIRMED');

    expect((await cancelAsChef(kitchen, order.id)).status).toBe(200);

    const cancelled = (await bellFor(customer.userId)).find((notice) => notice.kind === 'ORDER_CANCELLED_BY_CHEF');
    expect(cancelled).toEqual({
      kind: 'ORDER_CANCELLED_BY_CHEF',
      title: "Sam's Kitchen cancelled your order",
      body: order.orderNumber,
      link: `/orders/${order.id}`,
    });
  });

  it('tell the chef when the customer cancels, and send the customer nothing more', async () => {
    const kitchen = await openKitchen();
    const customer = await signUpDana();
    const order = await placedOrder(kitchen, customer);

    expect((await cancelAsCustomer(customer, order.id, 'Plans changed')).status).toBe(200);

    expect((await bellFor(kitchen.userId))[1]).toEqual({
      kind: 'ORDER_CANCELLED_BY_CUSTOMER',
      title: `Dana K. cancelled order ${order.orderNumber}`,
      body: 'Plans changed',
      link: '/chef/orders',
    });
    expect((await emailsFor(kitchen.userId)).map((email) => email.kind)).toEqual(['NEW_ORDER', 'ORDER_CANCELLED_BY_CUSTOMER']);
    expect(await bellFor(customer.userId)).toEqual([]);
    expect((await emailsFor(customer.userId)).map((email) => email.kind)).toEqual(['ORDER_PLACED']);
  });

  it('keep an emoji whole when a long reason is shortened for the bell', async () => {
    const kitchen = await openKitchen();
    const customer = await signUpDana();
    const declined = await placedOrder(kitchen, customer);
    const cancelled = await placedOrder(kitchen, customer);
    const reason = `${'a'.repeat(118)}😀 sorry`;

    expect((await cancelAsChef(kitchen, declined.id, reason)).status).toBe(200);
    expect((await cancelAsCustomer(customer, cancelled.id, reason)).status).toBe(200);

    const shortened = `${'a'.repeat(118)}😀…`;
    expect((await bellFor(customer.userId)).find((notice) => notice.kind === 'ORDER_CANCELLED_BY_CHEF')?.body).toBe(shortened);
    expect((await bellFor(kitchen.userId)).find((notice) => notice.kind === 'ORDER_CANCELLED_BY_CUSTOMER')?.body).toBe(shortened);
  });
});
