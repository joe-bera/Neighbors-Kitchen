import { Express } from 'express';
import request from 'supertest';

// Test-only helpers for signing up through the real API.

let sequence = 0;

export const API = '/api/v1';

export function bearer(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

export async function signUp(app: Express, role: 'CUSTOMER' | 'CHEF' = 'CUSTOMER') {
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
export async function signUpChefWithKitchen(app: Express) {
  const account = await signUp(app, 'CHEF');
  const res = await request(app).post(`${API}/chefs`).set(bearer(account.accessToken)).send(kitchenInput);
  if (res.status !== 201) throw new Error(`kitchen setup failed: ${JSON.stringify(res.body)}`);
  return { ...account, chefId: res.body.data.chefProfile.id as string };
}
