import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { API, bearer, signUp, signUpChefWithKitchen } from './helpers.js';

const app = createApp();

const tamales = {
  name: 'Tamales de Rajas',
  description: 'Corn masa tamales filled with roasted poblano strips and cheese.',
  price: 13.5,
  category: 'DINNER',
  cuisineType: 'Mexican',
  dietaryTags: ['vegetarian', 'gluten-free'],
  servings: 2,
  prepTimeMinutes: 90,
  maxOrdersPerDay: 10,
};

async function addMeal(accessToken: string, overrides: Record<string, unknown> = {}) {
  return request(app).post(`${API}/chefs/me/meals`).set(bearer(accessToken)).send({ ...tamales, ...overrides });
}

describe('POST /chefs/me/meals', () => {
  it('adds a meal that shows up in the public catalog', async () => {
    const chef = await signUpChefWithKitchen(app);

    const res = await addMeal(chef.accessToken);

    expect(res.status).toBe(201);
    expect(res.body.data.meal).toMatchObject({ name: 'Tamales de Rajas', price: 13.5, isAvailable: true, maxOrdersPerDay: 10 });
    const catalog = await request(app).get(`${API}/meals`);
    expect(catalog.body.data.map((meal: { name: string }) => meal.name)).toEqual(['Tamales de Rajas']);
  });

  it('keeps a meal out of the catalog until the chef makes it available', async () => {
    const chef = await signUpChefWithKitchen(app);

    await addMeal(chef.accessToken, { isAvailable: false });

    const catalog = await request(app).get(`${API}/meals`);
    expect(catalog.body.data).toEqual([]);
  });

  it('checks the meal details', async () => {
    const chef = await signUpChefWithKitchen(app);

    const res = await addMeal(chef.accessToken, { price: 0, dietaryTags: ['paleo'] });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toHaveProperty('price');
    expect(res.body.error.details).toHaveProperty(['dietaryTags.0']);
  });

  it('only accepts photos uploaded through Neighbors Kitchen', async () => {
    const chef = await signUpChefWithKitchen(app);

    const outside = await addMeal(chef.accessToken, { imageUrl: 'https://evil.example/tracker.jpg' });
    const uploaded = await addMeal(chef.accessToken, {
      imageUrl: '/uploads/meals/3f1c2b7a-8d4e-4f7a-9b2c-1a2b3c4d5e6f.webp',
    });

    expect(outside.status).toBe(422);
    expect(outside.body.error.details).toHaveProperty('imageUrl');
    expect(uploaded.status).toBe(201);
  });

  it('is only for chefs who have set up a kitchen', async () => {
    const customer = await signUp(app, 'CUSTOMER');
    const newChef = await signUp(app, 'CHEF');

    expect((await addMeal(customer.accessToken)).status).toBe(403);
    expect((await addMeal(newChef.accessToken)).body.error.code).toBe('NO_CHEF_PROFILE');
  });
});

describe('GET /chefs/me/meals', () => {
  it("lists all of the chef's own meals, newest first, including hidden ones", async () => {
    const chef = await signUpChefWithKitchen(app);
    const otherChef = await signUpChefWithKitchen(app);
    await addMeal(chef.accessToken, { name: 'First meal' });
    await addMeal(chef.accessToken, { name: 'Hidden meal', isAvailable: false });
    await addMeal(otherChef.accessToken, { name: 'Somebody else' });

    const res = await request(app).get(`${API}/chefs/me/meals`).set(bearer(chef.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.map((meal: { name: string }) => meal.name)).toEqual(['Hidden meal', 'First meal']);
  });
});

describe('PUT /chefs/me/meals/:id', () => {
  it('changes only the fields that are sent', async () => {
    const chef = await signUpChefWithKitchen(app);
    const created = await addMeal(chef.accessToken);

    const res = await request(app)
      .put(`${API}/chefs/me/meals/${created.body.data.meal.id}`)
      .set(bearer(chef.accessToken))
      .send({ price: 15, isAvailable: false });

    expect(res.status).toBe(200);
    expect(res.body.data.meal).toMatchObject({ name: 'Tamales de Rajas', price: 15, isAvailable: false, servings: 2 });
  });

  it("cannot change another chef's meal", async () => {
    const owner = await signUpChefWithKitchen(app);
    const intruder = await signUpChefWithKitchen(app);
    const created = await addMeal(owner.accessToken);

    const res = await request(app)
      .put(`${API}/chefs/me/meals/${created.body.data.meal.id}`)
      .set(bearer(intruder.accessToken))
      .send({ price: 1 });

    expect(res.status).toBe(404);
    const meal = await prisma.meal.findUniqueOrThrow({ where: { id: created.body.data.meal.id } });
    expect(meal.price.toNumber()).toBe(13.5);
  });

  it('keeps a photo the meal already had, even one from before uploads existed', async () => {
    const chef = await signUpChefWithKitchen(app);
    const created = await addMeal(chef.accessToken);
    const legacyPhoto = 'https://www.themealdb.com/images/media/meals/example.jpg';
    await prisma.meal.update({ where: { id: created.body.data.meal.id }, data: { imageUrl: legacyPhoto } });

    const res = await request(app)
      .put(`${API}/chefs/me/meals/${created.body.data.meal.id}`)
      .set(bearer(chef.accessToken))
      .send({ name: 'Tamales Verdes', imageUrl: legacyPhoto });

    expect(res.status).toBe(200);
    expect(res.body.data.meal.imageUrl).toBe(legacyPhoto);
  });
});

describe('DELETE /chefs/me/meals/:id', () => {
  it('deletes a meal', async () => {
    const chef = await signUpChefWithKitchen(app);
    const created = await addMeal(chef.accessToken);

    const res = await request(app).delete(`${API}/chefs/me/meals/${created.body.data.meal.id}`).set(bearer(chef.accessToken));

    expect(res.status).toBe(204);
    expect(await prisma.meal.count()).toBe(0);
  });

  it("cannot delete another chef's meal", async () => {
    const owner = await signUpChefWithKitchen(app);
    const intruder = await signUpChefWithKitchen(app);
    const created = await addMeal(owner.accessToken);

    const res = await request(app).delete(`${API}/chefs/me/meals/${created.body.data.meal.id}`).set(bearer(intruder.accessToken));

    expect(res.status).toBe(404);
    expect(await prisma.meal.count()).toBe(1);
  });

  it('keeps meals that have been ordered and suggests hiding them instead', async () => {
    const chef = await signUpChefWithKitchen(app);
    const customer = await signUp(app, 'CUSTOMER');
    const created = await addMeal(chef.accessToken);
    await prisma.order.create({
      data: {
        orderNumber: 'NK-TEST-1',
        customerId: customer.userId,
        chefId: chef.chefId,
        subtotal: 13.5,
        platformFee: 1.35,
        total: 14.85,
        pickupOrDelivery: 'PICKUP',
        scheduledFor: new Date(Date.now() + 86_400_000),
        orderItems: { create: { mealId: created.body.data.meal.id, quantity: 1, priceAtPurchase: 13.5 } },
      },
    });

    const res = await request(app).delete(`${API}/chefs/me/meals/${created.body.data.meal.id}`).set(bearer(chef.accessToken));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MEAL_HAS_ORDERS');
    expect(await prisma.meal.count()).toBe(1);
  });
});
