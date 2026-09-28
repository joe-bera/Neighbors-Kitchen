import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { API, bearer, completedOrder, type Kitchen, openKitchen, signUp } from './helpers.js';
import { bellFor, emailsFor } from './notificationHelpers.js';

const app = createApp();

type Person = { userId: string; accessToken: string };

// Test chefs are Sam Rivera of "Sam's Kitchen"; the customer is Dana Kim.
const signUpDana = () => signUp(app, 'CUSTOMER', { firstName: 'Dana', lastName: 'Kim' });

const birria = { mealName: 'Birria tacos', description: 'Slow-cooked beef birria with consommé for dipping, please!' };

function review(customer: Person, orderId: string, mealId: string) {
  return request(app).post(`${API}/reviews`).set(bearer(customer.accessToken)).send({ orderId, mealId, rating: 5, comment: 'Tasted like home.' });
}

function requestDish(person: Person, chefId: string) {
  return request(app).post(`${API}/chefs/${chefId}/suggestions`).set(bearer(person.accessToken)).send(birria);
}

async function newRequest(kitchen: Kitchen, asker: Person) {
  const res = await requestDish(asker, kitchen.chefId);
  expect(res.status).toBe(201);
  return res.body.data.suggestion.id as string;
}

function answer(kitchen: Kitchen, suggestionId: string, status: string, chefResponse: string | null = null) {
  return request(app).put(`${API}/chefs/me/suggestions/${suggestionId}`).set(bearer(kitchen.accessToken)).send({ status, chefResponse });
}

function vote(person: Person, suggestionId: string) {
  return request(app).post(`${API}/suggestions/${suggestionId}/vote`).set(bearer(person.accessToken));
}

const kinds = (rows: { kind: string }[]) => rows.map((row) => row.kind);

describe('New reviews', () => {
  it('ring the chef\'s bell and email the chef', async () => {
    const kitchen = await openKitchen();
    const customer = await signUpDana();
    const orderId = await completedOrder(kitchen, customer.accessToken);

    expect((await review(customer, orderId, kitchen.mealId)).status).toBe(201);

    expect((await bellFor(kitchen.userId)).filter((notice) => notice.kind === 'NEW_REVIEW')).toEqual([
      { kind: 'NEW_REVIEW', title: 'New 5-star review for Tamales', body: 'Tasted like home.', link: '/chef/feedback' },
    ]);
    const [email] = (await emailsFor(kitchen.userId)).filter((row) => row.kind === 'NEW_REVIEW');
    expect(email.data).toMatchObject({ mealName: 'Tamales', rating: 5, comment: 'Tasted like home.', customerName: 'Dana K.' });
  });

  it("still ring the bell when the chef turned those emails off", async () => {
    const kitchen = await openKitchen();
    await prisma.user.update({ where: { id: kitchen.userId }, data: { emailKitchenFeedback: false } });
    const customer = await signUpDana();
    const orderId = await completedOrder(kitchen, customer.accessToken);

    await review(customer, orderId, kitchen.mealId);

    expect(kinds(await bellFor(kitchen.userId))).toContain('NEW_REVIEW');
    expect(kinds(await emailsFor(kitchen.userId))).not.toContain('NEW_REVIEW');
  });
});

describe('New dish requests', () => {
  it('ring the chef\'s bell and email the request to the chef', async () => {
    const kitchen = await openKitchen();
    const asker = await signUpDana();

    await newRequest(kitchen, asker);

    expect(await bellFor(kitchen.userId)).toEqual([
      { kind: 'NEW_DISH_REQUEST', title: 'New dish request: Birria tacos', body: 'From Dana K.', link: '/chef/feedback' },
    ]);
    const [email] = await emailsFor(kitchen.userId);
    expect(email).toMatchObject({
      kind: 'NEW_DISH_REQUEST',
      data: { kitchenName: "Sam's Kitchen", mealName: 'Birria tacos', description: birria.description, status: 'PENDING', requesterName: 'Dana K.' },
    });
  });

  it('create nothing when the request is refused', async () => {
    const kitchen = await openKitchen();

    expect((await requestDish(kitchen, kitchen.chefId)).status).toBe(409);

    expect(await prisma.notification.count()).toBe(0);
    expect(await prisma.email.count()).toBe(0);
  });
});
