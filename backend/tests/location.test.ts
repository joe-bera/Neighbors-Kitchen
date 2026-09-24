import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createChef, createMeal } from './factories.js';

const app = createApp();
const API = '/api/v1';

// Public area centers for test kitchens, and their straight-line miles from the middle of ZIP 92373
// (34.0119, -117.1597, south Redlands), worked out by hand: 3.4, 12.5 and 37.4.
const REDLANDS = { latitude: 34.0571, longitude: -117.1812 };
const RIVERSIDE = { latitude: 33.9806, longitude: -117.3755 };
const PALM_SPRINGS = { latitude: 33.8303, longitude: -116.5453 };
const ZIP_92373 = { latitude: 34.0119, longitude: -117.1597 };

async function kitchenAt(kitchenName: string, area?: { latitude: number; longitude: number }, cuisine = 'Mexican') {
  const owner = await createChef({ kitchenName, area, specialties: [cuisine] });
  await createMeal(owner, { cuisineType: cuisine });
  return owner.chef;
}

const names = (chefs: { kitchenName: string }[]) => chefs.map((chef) => chef.kitchenName);

describe('GET /chefs near a place', () => {
  it('lists chefs nearest first, with how far away each one is', async () => {
    await kitchenAt('Palm Springs Kitchen', PALM_SPRINGS);
    await kitchenAt('Riverside Kitchen', RIVERSIDE);
    await kitchenAt('Redlands Kitchen', REDLANDS);

    const res = await request(app).get(`${API}/chefs`).query({ near: '92373' });

    expect(res.status).toBe(200);
    expect(names(res.body.data)).toEqual(['Redlands Kitchen', 'Riverside Kitchen', 'Palm Springs Kitchen']);
    expect(res.body.data.map((chef: { distanceMiles: number }) => chef.distanceMiles)).toEqual([3.4, 12.5, 37.4]);
    expect(res.body.pagination.total).toBe(3);
  });

  it('keeps to the distance limit', async () => {
    await kitchenAt('Palm Springs Kitchen', PALM_SPRINGS);
    await kitchenAt('Riverside Kitchen', RIVERSIDE);
    await kitchenAt('Redlands Kitchen', REDLANDS);

    const res = await request(app).get(`${API}/chefs`).query({ near: '92373', maxDistance: 25 });

    expect(names(res.body.data)).toEqual(['Redlands Kitchen', 'Riverside Kitchen']);
    expect(res.body.pagination.total).toBe(2);
  });

  it('searches from a browser location', async () => {
    await kitchenAt('Redlands Kitchen', REDLANDS);
    await kitchenAt('Palm Springs Kitchen', PALM_SPRINGS);

    const res = await request(app).get(`${API}/chefs`).query({ lat: 33.83, lng: -116.55 });

    expect(names(res.body.data)).toEqual(['Palm Springs Kitchen', 'Redlands Kitchen']);
  });

  it('pages through nearby chefs in distance order', async () => {
    // Created out of distance order, so only sorting by distance puts Riverside second.
    await kitchenAt('Riverside Kitchen', RIVERSIDE);
    await kitchenAt('Redlands Kitchen', REDLANDS);
    await kitchenAt('Palm Springs Kitchen', PALM_SPRINGS);

    const res = await request(app).get(`${API}/chefs`).query({ near: '92373', limit: 1, page: 2 });

    expect(names(res.body.data)).toEqual(['Riverside Kitchen']);
    expect(res.body.pagination).toEqual({ page: 2, limit: 1, total: 3, totalPages: 3 });
  });

  it('combines distance with the other filters', async () => {
    await kitchenAt('Redlands Kitchen', REDLANDS, 'Mexican');
    await kitchenAt('Palm Springs Sushi', PALM_SPRINGS, 'Japanese');
    await kitchenAt('Riverside Sushi', RIVERSIDE, 'Japanese');

    const res = await request(app).get(`${API}/chefs`).query({ near: '92373', maxDistance: 25, cuisine: 'Japanese' });

    expect(names(res.body.data)).toEqual(['Riverside Sushi']);
  });

  it('leaves out chefs without a map area, but still lists them in a normal search', async () => {
    await kitchenAt('Redlands Kitchen', REDLANDS);
    await kitchenAt('Unmapped Kitchen');

    const near = await request(app).get(`${API}/chefs`).query({ near: '92373' });
    const all = await request(app).get(`${API}/chefs`);

    expect(names(near.body.data)).toEqual(['Redlands Kitchen']);
    expect(all.body.data).toHaveLength(2);
    expect(all.body.data.every((chef: { distanceMiles: number | null }) => chef.distanceMiles === null)).toBe(true);
  });

  it('ignores a distance limit when no place is given', async () => {
    await kitchenAt('Palm Springs Kitchen', PALM_SPRINGS);

    const res = await request(app).get(`${API}/chefs`).query({ maxDistance: 5 });

    expect(names(res.body.data)).toEqual(['Palm Springs Kitchen']);
  });

  it('explains an unknown ZIP code', async () => {
    const res = await request(app).get(`${API}/chefs`).query({ near: '00000' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UNKNOWN_ZIP');
    expect(res.body.error.message).toBe('We could not find ZIP code 00000');
  });

  it('needs both lat and lng, and not a ZIP code as well', async () => {
    const halfLocation = await request(app).get(`${API}/chefs`).query({ lat: 34.05 });
    const both = await request(app).get(`${API}/chefs`).query({ near: '92373', lat: 34.05, lng: -117.18 });

    expect(halfLocation.status).toBe(422);
    expect(halfLocation.body.error.details).toHaveProperty('lng');
    expect(both.status).toBe(422);
    expect(both.body.error.details).toHaveProperty('near');
  });
});

describe('GET /chefs/map', () => {
  it('returns the area of every matching chef, nearest first, and where the search starts', async () => {
    const redlands = await kitchenAt('Redlands Kitchen', REDLANDS);
    await kitchenAt('Riverside Kitchen', RIVERSIDE);

    const res = await request(app).get(`${API}/chefs/map`).query({ near: '92373', page: 2 });

    expect(res.status).toBe(200);
    expect(res.body.data.origin).toEqual(ZIP_92373);
    expect(names(res.body.data.chefs)).toEqual(['Redlands Kitchen', 'Riverside Kitchen']);
    expect(res.body.data.chefs[0]).toEqual({
      id: redlands.id,
      kitchenName: 'Redlands Kitchen',
      chefName: 'Maria D.',
      firstName: 'Maria',
      city: 'Redlands',
      averageRating: null,
      totalReviews: 0,
      isAcceptingOrders: true,
      distanceMiles: 3.4,
      area: { ...REDLANDS, radiusMiles: 0.5 },
    });
  });

  it('shows every chef that has an area when no place is given', async () => {
    await kitchenAt('Redlands Kitchen', REDLANDS);
    await kitchenAt('Unmapped Kitchen');

    const res = await request(app).get(`${API}/chefs/map`);

    expect(res.body.data.origin).toBeNull();
    expect(names(res.body.data.chefs)).toEqual(['Redlands Kitchen']);
    expect(res.body.data.chefs[0].distanceMiles).toBeNull();
  });

  it('keeps to the distance limit', async () => {
    await kitchenAt('Redlands Kitchen', REDLANDS);
    await kitchenAt('Palm Springs Kitchen', PALM_SPRINGS);

    const res = await request(app).get(`${API}/chefs/map`).query({ near: '92373', maxDistance: 25 });

    expect(names(res.body.data.chefs)).toEqual(['Redlands Kitchen']);
  });

  it('explains an unknown ZIP code', async () => {
    const res = await request(app).get(`${API}/chefs/map`).query({ near: '00000' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UNKNOWN_ZIP');
  });
});

describe('The public area on a chef page', () => {
  it('shows the area but never the exact location', async () => {
    const chef = await kitchenAt('Redlands Kitchen', REDLANDS);

    const res = await request(app).get(`${API}/chefs/${chef.id}`);

    expect(res.body.data.chef.area).toEqual({ ...REDLANDS, radiusMiles: 0.5 });
    // The factory's exact location is 34.0556, -117.1825.
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('34.0556');
    expect(body).not.toContain('117.1825');
  });

  it('has no area for a chef who is not on the map', async () => {
    const chef = await kitchenAt('Unmapped Kitchen');

    const res = await request(app).get(`${API}/chefs/${chef.id}`);

    expect(res.body.data.chef.area).toBeNull();
  });
});
