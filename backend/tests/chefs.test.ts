import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createChef, createMeal } from './factories.js';

const app = createApp();
const API = '/api/v1';

const PRIVATE_FIELDS = ['addressLine1', 'addressLine2', 'zipCode', 'latitude', 'longitude', 'userId', 'email', 'stripeConnectAccountId'];

function expectNoPrivateFields(chef: Record<string, unknown>) {
  for (const field of PRIVATE_FIELDS) {
    expect(chef).not.toHaveProperty(field);
  }
}

describe('GET /chefs', () => {
  it('lists chefs that have something to order, with public details only', async () => {
    const maria = await createChef({ firstName: 'Maria', lastName: 'Delgado', kitchenName: "Abuela's Table" });
    await createMeal(maria, { name: 'Enchiladas' });
    await createMeal(maria, { name: 'Sold-out Pozole', isAvailable: false });
    await createChef({ firstName: 'Nobody', kitchenName: 'Empty Kitchen' });

    const res = await request(app).get(`${API}/chefs`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    const [chef] = res.body.data;
    expect(chef).toMatchObject({
      id: maria.chef.id,
      kitchenName: "Abuela's Table",
      chefName: 'Maria D.',
      city: 'Redlands',
      state: 'CA',
      specialties: ['Mexican'],
      mealCount: 1,
      averageRating: null,
      totalReviews: 0,
    });
    expect(chef.coverImageUrl).toMatch(/^https:\/\//);
    expectNoPrivateFields(chef);
  });

  it('hides chefs whose accounts are deactivated', async () => {
    const inactive = await createChef({ isActive: false });
    await createMeal(inactive);

    const res = await request(app).get(`${API}/chefs`);

    expect(res.body.data).toEqual([]);
  });

  it('finds chefs by cuisine, ignoring capitalization', async () => {
    const maria = await createChef({ specialties: ['Mexican'] });
    await createMeal(maria, { cuisineType: 'Mexican' });
    const kenji = await createChef({ specialties: ['Japanese'] });
    await createMeal(kenji, { cuisineType: 'Japanese' });

    const res = await request(app).get(`${API}/chefs`).query({ search: 'mexican' });

    expect(res.body.data.map((chef: { id: string }) => chef.id)).toEqual([maria.chef.id]);
  });

  it('finds chefs by kitchen name', async () => {
    const maria = await createChef({ kitchenName: "Abuela's Table" });
    await createMeal(maria);
    const tony = await createChef({ kitchenName: "Nonna Rosa's" });
    await createMeal(tony);

    const res = await request(app).get(`${API}/chefs`).query({ search: 'ABUELA' });

    expect(res.body.data.map((chef: { id: string }) => chef.id)).toEqual([maria.chef.id]);
  });

  it('filters chefs by city', async () => {
    const redlands = await createChef({ city: 'Redlands' });
    await createMeal(redlands);
    const riverside = await createChef({ city: 'Riverside' });
    await createMeal(riverside);

    const res = await request(app).get(`${API}/chefs`).query({ city: 'riverside' });

    expect(res.body.data.map((chef: { id: string }) => chef.id)).toEqual([riverside.chef.id]);
  });

  it('splits long results into pages', async () => {
    for (let index = 0; index < 3; index += 1) {
      await createMeal(await createChef());
    }

    const res = await request(app).get(`${API}/chefs`).query({ page: 2, limit: 2 });

    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
  });

  it('rejects a page size above 50', async () => {
    const res = await request(app).get(`${API}/chefs`).query({ limit: 51 });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toHaveProperty('limit');
  });
});

describe('GET /chefs/:id', () => {
  it("shows the chef's profile with the meals that can be ordered", async () => {
    const maria = await createChef({ firstName: 'Maria', lastName: 'Delgado' });
    const enchiladas = await createMeal(maria, { name: 'Enchiladas', price: 14 });
    await createMeal(maria, { name: 'Sold-out Pozole', isAvailable: false });

    const res = await request(app).get(`${API}/chefs/${maria.chef.id}`);

    expect(res.status).toBe(200);
    const chef = res.body.data.chef;
    expect(chef).toMatchObject({
      id: maria.chef.id,
      chefName: 'Maria D.',
      bio: 'Home cooking with love.',
      yearsExperience: 10,
      certifications: ['California Food Handler Card'],
    });
    expectNoPrivateFields(chef);
    expect(chef.menus).toHaveLength(1);
    expect(chef.menus[0].meals.map((meal: { id: string }) => meal.id)).toEqual([enchiladas.id]);
    expect(chef.menus[0].meals[0].price).toBe(14);
  });

  it('returns 404 for a chef that does not exist', async () => {
    const res = await request(app).get(`${API}/chefs/does-not-exist`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 for a deactivated chef', async () => {
    const inactive = await createChef({ isActive: false });
    await createMeal(inactive);

    const res = await request(app).get(`${API}/chefs/${inactive.chef.id}`);

    expect(res.status).toBe(404);
  });
});
