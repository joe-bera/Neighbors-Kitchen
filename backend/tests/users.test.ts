import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

const app = createApp();
const API = '/api/v1';

async function signUp(role: 'CUSTOMER' | 'CHEF' = 'CUSTOMER') {
  const res = await request(app).post(`${API}/auth/register`).send({
    email: `${role.toLowerCase()}@example.com`,
    password: 'Tacos4ever',
    firstName: 'Sam',
    lastName: 'Rivera',
    role,
  });
  return { userId: res.body.data.user.id as string, accessToken: res.body.data.accessToken as string };
}

describe('GET /users/me', () => {
  it('returns the signed-in user without any secrets', async () => {
    const { accessToken } = await signUp();

    const res = await request(app).get(`${API}/users/me`).set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ email: 'customer@example.com', role: 'CUSTOMER', chefProfile: null });
    for (const secret of ['passwordHash', 'failedLoginAttempts', 'lockedUntil', 'passwordResetToken']) {
      expect(res.body.data.user).not.toHaveProperty(secret);
    }
  });

  it('requires a token', async () => {
    const res = await request(app).get(`${API}/users/me`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('rejects a token signed with a different secret', async () => {
    const { userId } = await signUp();
    const forged = jwt.sign({ sub: userId, role: 'ADMIN' }, 'some-other-secret-that-is-also-long-enough');

    const res = await request(app).get(`${API}/users/me`).set('Authorization', `Bearer ${forged}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('tells the client when the token has expired', async () => {
    const { userId } = await signUp();
    const expired = jwt.sign({ sub: userId, role: 'CUSTOMER' }, process.env.JWT_SECRET!, { expiresIn: -10 });

    const res = await request(app).get(`${API}/users/me`).set('Authorization', `Bearer ${expired}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('includes a summary of the kitchen for chefs', async () => {
    const { userId, accessToken } = await signUp('CHEF');
    const chef = await prisma.chefProfile.create({
      data: {
        userId,
        kitchenName: "Sam's Kitchen",
        specialties: ['Mexican'],
        addressLine1: '1 Test St',
        city: 'Redlands',
        state: 'CA',
        zipCode: '92373',
        latitude: 34.0556,
        longitude: -117.1825,
      },
    });
    const menu = await prisma.menu.create({ data: { chefId: chef.id, name: 'Weekly Menu' } });
    for (const name of ['Tacos', 'Pozole']) {
      await prisma.meal.create({
        data: { menuId: menu.id, chefId: chef.id, name, description: name, price: 12, category: 'DINNER', prepTimeMinutes: 30 },
      });
    }

    const res = await request(app).get(`${API}/users/me`).set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.chefProfile).toMatchObject({
      kitchenName: "Sam's Kitchen",
      city: 'Redlands',
      state: 'CA',
      specialties: ['Mexican'],
      mealCount: 2,
    });
  });
});
