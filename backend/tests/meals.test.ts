import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createChef, createMeal } from './factories.js';

const app = createApp();
const API = '/api/v1';

const ids = (res: request.Response) => res.body.data.map((meal: { id: string }) => meal.id);
const names = (res: request.Response) => res.body.data.map((meal: { name: string }) => meal.name);

describe('GET /meals', () => {
  it('lists only meals that can be ordered', async () => {
    const maria = await createChef();
    const available = await createMeal(maria, { name: 'Enchiladas' });
    await createMeal(maria, { name: 'Sold out', isAvailable: false });
    const inactiveChef = await createChef({ isActive: false });
    await createMeal(inactiveChef, { name: 'From a deactivated chef' });
    const retiredMenu = await createChef({ menuIsActive: false });
    await createMeal(retiredMenu, { name: 'From a retired menu' });

    const res = await request(app).get(`${API}/meals`);

    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([available.id]);
  });

  it('shows who cooks each meal, without private chef details', async () => {
    const maria = await createChef({ firstName: 'Maria', lastName: 'Delgado', kitchenName: "Abuela's Table", city: 'Redlands' });
    await createMeal(maria, { name: 'Enchiladas', price: 14.5 });

    const res = await request(app).get(`${API}/meals`);

    const [meal] = res.body.data;
    expect(meal).toMatchObject({ name: 'Enchiladas', price: 14.5 });
    expect(meal.chef).toEqual({
      id: maria.chef.id,
      kitchenName: "Abuela's Table",
      chefName: 'Maria D.',
      city: 'Redlands',
      state: 'CA',
      isAcceptingOrders: true,
    });
  });

  it('filters by category', async () => {
    const chef = await createChef();
    await createMeal(chef, { name: 'Flan', category: 'DESSERT' });
    await createMeal(chef, { name: 'Tacos', category: 'DINNER' });

    const res = await request(app).get(`${API}/meals`).query({ category: 'dessert' });

    expect(names(res)).toEqual(['Flan']);
  });

  it('filters by dietary needs, requiring every selected tag', async () => {
    const chef = await createChef();
    await createMeal(chef, { name: 'Dal', dietaryTags: ['vegan', 'gluten-free'] });
    await createMeal(chef, { name: 'Falafel', dietaryTags: ['vegan'] });
    await createMeal(chef, { name: 'Steak', dietaryTags: ['gluten-free'] });

    const res = await request(app).get(`${API}/meals`).query({ dietary: 'vegan,gluten-free' });

    expect(names(res)).toEqual(['Dal']);
  });

  it('filters by maximum price, including meals at exactly that price', async () => {
    const chef = await createChef();
    await createMeal(chef, { name: 'Ten', price: 10 });
    await createMeal(chef, { name: 'Eleven', price: 11 });

    const res = await request(app).get(`${API}/meals`).query({ maxPrice: 10 });

    expect(names(res)).toEqual(['Ten']);
  });

  it('searches names, descriptions and cuisines, ignoring capitalization', async () => {
    const chef = await createChef();
    await createMeal(chef, { name: 'Chicken Enchiladas', cuisineType: 'Mexican' });
    await createMeal(chef, { name: 'Soup of the day', description: 'Creamy enchilada-style soup', cuisineType: 'Fusion' });
    await createMeal(chef, { name: 'Katsu Curry', cuisineType: 'Japanese' });

    const byName = await request(app).get(`${API}/meals`).query({ search: 'ENCHILADA' });
    const byCuisine = await request(app).get(`${API}/meals`).query({ search: 'japanese' });

    expect(names(byName).sort()).toEqual(['Chicken Enchiladas', 'Soup of the day']);
    expect(names(byCuisine)).toEqual(['Katsu Curry']);
  });

  it("finds a chef's meals by kitchen name", async () => {
    const maria = await createChef({ kitchenName: "Abuela's Table" });
    await createMeal(maria, { name: 'Enchiladas' });
    const tony = await createChef({ kitchenName: "Nonna Rosa's" });
    await createMeal(tony, { name: 'Lasagna' });

    const res = await request(app).get(`${API}/meals`).query({ search: 'abuela' });

    expect(names(res)).toEqual(['Enchiladas']);
  });

  it('sorts by price in either direction', async () => {
    const chef = await createChef();
    await createMeal(chef, { name: 'Middle', price: 12 });
    await createMeal(chef, { name: 'Cheap', price: 6 });
    await createMeal(chef, { name: 'Pricey', price: 18 });

    const ascending = await request(app).get(`${API}/meals`).query({ sort: 'price_asc' });
    const descending = await request(app).get(`${API}/meals`).query({ sort: 'price_desc' });

    expect(names(ascending)).toEqual(['Cheap', 'Middle', 'Pricey']);
    expect(names(descending)).toEqual(['Pricey', 'Middle', 'Cheap']);
  });

  it('rejects an unknown category', async () => {
    const res = await request(app).get(`${API}/meals`).query({ category: 'PIZZA' });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toHaveProperty('category');
  });
});

describe('GET /meals/:id', () => {
  it('shows the meal with its chef and up to four other meals from the same chef', async () => {
    const maria = await createChef({ kitchenName: "Abuela's Table" });
    const enchiladas = await createMeal(maria, { name: 'Enchiladas' });
    const others = [];
    for (let index = 0; index < 5; index += 1) {
      others.push(await createMeal(maria, { name: `Other ${index}` }));
    }
    const tony = await createChef();
    await createMeal(tony, { name: 'Lasagna' });

    const res = await request(app).get(`${API}/meals/${enchiladas.id}`);

    expect(res.status).toBe(200);
    const { meal } = res.body.data;
    expect(meal).toMatchObject({ id: enchiladas.id, name: 'Enchiladas', chef: { kitchenName: "Abuela's Table" } });
    expect(meal.moreFromChef).toHaveLength(4);
    const moreNames = meal.moreFromChef.map((other: { name: string }) => other.name);
    expect(moreNames).not.toContain('Enchiladas');
    expect(moreNames).not.toContain('Lasagna');
  });

  it('returns 404 for a meal that cannot be ordered', async () => {
    const chef = await createChef();
    const soldOut = await createMeal(chef, { isAvailable: false });

    const res = await request(app).get(`${API}/meals/${soldOut.id}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /meals/filters', () => {
  it('lists the cuisines, dietary tags and cities that have meals to order', async () => {
    const redlands = await createChef({ city: 'Redlands' });
    await createMeal(redlands, { cuisineType: 'Mexican', dietaryTags: ['vegetarian', 'gluten-free'] });
    await createMeal(redlands, { cuisineType: 'Mexican', dietaryTags: ['vegetarian'] });
    const riverside = await createChef({ city: 'Riverside' });
    await createMeal(riverside, { cuisineType: 'Japanese', dietaryTags: [] });
    const hidden = await createChef({ city: 'Indio' });
    await createMeal(hidden, { cuisineType: 'Vegan', dietaryTags: ['vegan'], isAvailable: false });

    const res = await request(app).get(`${API}/meals/filters`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      categories: ['BREAKFAST', 'LUNCH', 'DINNER', 'DESSERT', 'SNACK'],
      cuisines: ['Japanese', 'Mexican'],
      dietaryTags: ['gluten-free', 'vegetarian'],
      cities: ['Redlands', 'Riverside'],
    });
  });
});
