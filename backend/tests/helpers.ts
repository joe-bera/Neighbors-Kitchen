import { Express } from 'express';
import { DateTime } from 'luxon';
import request from 'supertest';
import { createApp } from '../src/app.js';

// Test-only helpers that set things up through the real API.

let sequence = 0;
const app = createApp();

export const API = '/api/v1';
export const LA = 'America/Los_Angeles';

export function bearer(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

export async function signUp(_app: Express = app, role: 'CUSTOMER' | 'CHEF' = 'CUSTOMER') {
  sequence += 1;
  const res = await request(app).post(`${API}/auth/register`).send({
    email: `person${sequence}@example.com`,
    password: 'Tacos4ever',
    firstName: 'Sam',
    lastName: 'Rivera',
    role,
  });
  if (res.status !== 201) throw new Error(`sign-up failed: ${JSON.stringify(res.body)}`);
  const refreshCookie = res.get('Set-Cookie')?.find((cookie) => cookie.startsWith('nk_refresh='))?.split(';')[0] ?? '';
  return {
    userId: res.body.data.user.id as string,
    accessToken: res.body.data.accessToken as string,
    refreshCookie,
  };
}

export const kitchenInput = {
  kitchenName: "Sam's Kitchen",
  bio: 'Family recipes from Oaxaca, cooked fresh every week.',
  specialties: ['Mexican', 'Vegetarian'],
  yearsExperience: 8,
  certifications: ['California Food Handler Card'],
  addressLine1: '742 Evergreen Terrace',
  addressLine2: '',
  city: 'Redlands',
  state: 'ca',
  zipCode: '92373',
  serviceRadiusMiles: 10,
};

/** Signs up a chef and sets up their kitchen. */
export async function signUpChefWithKitchen(_app: Express = app) {
  const account = await signUp(app, 'CHEF');
  const res = await request(app).post(`${API}/chefs`).set(bearer(account.accessToken)).send(kitchenInput);
  if (res.status !== 201) throw new Error(`kitchen setup failed: ${JSON.stringify(res.body)}`);
  return { ...account, chefId: res.body.data.chefProfile.id as string };
}

/** A half-hour mark N days from now, in Los Angeles time, as a UTC ISO string. */
export function daysFromNowAt(days: number, hour: number) {
  return DateTime.now().setZone(LA).plus({ days }).set({ hour, minute: 0, second: 0, millisecond: 0 }).toUTC().toISO()!;
}

const everyDay = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startTime: '08:00', endTime: '21:00' }));

export async function addMeal(accessToken: string, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post(`${API}/chefs/me/meals`)
    .set(bearer(accessToken))
    .send({
      name: 'Tamales',
      description: 'Corn masa tamales with rajas and cheese.',
      price: 13.5,
      category: 'DINNER',
      servings: 2,
      prepTimeMinutes: 60,
      ...overrides,
    });
  if (res.status !== 201) throw new Error(`adding a meal failed: ${JSON.stringify(res.body)}`);
  return res.body.data.meal.id as string;
}

/** A chef open every day 8 AM to 9 PM with a one-hour lead time and one meal on the menu. */
export async function openKitchen(options: { offersDelivery?: boolean; deliveryFee?: number; leadHours?: number } = {}) {
  const chef = await signUpChefWithKitchen(app);
  await request(app)
    .put(`${API}/chefs/me/availability`)
    .set(bearer(chef.accessToken))
    .send({
      schedule: everyDay,
      orderLeadTimeHours: options.leadHours ?? 1,
      offersPickup: true,
      offersDelivery: options.offersDelivery ?? false,
      deliveryFee: options.deliveryFee ?? 0,
    });
  const mealId = await addMeal(chef.accessToken);
  return { ...chef, mealId };
}

export type Kitchen = Awaited<ReturnType<typeof openKitchen>>;

export function pickupOrder(kitchen: Kitchen, overrides: Record<string, unknown> = {}) {
  return {
    chefId: kitchen.chefId,
    items: [{ mealId: kitchen.mealId, quantity: 2 }],
    pickupOrDelivery: 'PICKUP',
    scheduledFor: daysFromNowAt(1, 18),
    ...overrides,
  };
}

export function placeOrder(accessToken: string, body: Record<string, unknown>) {
  return request(app).post(`${API}/orders`).set(bearer(accessToken)).send(body);
}

export function setOrderStatus(kitchen: Kitchen, orderId: string, status: string) {
  return request(app).post(`${API}/chefs/me/orders/${orderId}/status`).set(bearer(kitchen.accessToken)).send({ status });
}

/** Places a pickup order for the kitchen's meal and walks it all the way to completed. */
export async function completedOrder(kitchen: Kitchen, customerAccessToken: string, overrides: Record<string, unknown> = {}) {
  const placed = await placeOrder(customerAccessToken, pickupOrder(kitchen, overrides));
  if (placed.status !== 201) throw new Error(`placing an order failed: ${JSON.stringify(placed.body)}`);
  const orderId = placed.body.data.order.id as string;
  for (const status of ['CONFIRMED', 'PREPARING', 'READY', 'COMPLETED']) {
    await setOrderStatus(kitchen, orderId, status);
  }
  return orderId;
}
