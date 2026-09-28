import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { API, availabilityInput, bearer, type Kitchen, openKitchen } from './helpers.js';

const app = createApp();

const saveHours = (kitchen: Kitchen, overrides: Record<string, unknown> = {}) =>
  request(app).put(`${API}/chefs/me/availability`).set(bearer(kitchen.accessToken)).send(availabilityInput(overrides));
const publicProfile = (kitchen: Kitchen) => request(app).get(`${API}/chefs/${kitchen.chefId}`);
const ownKitchen = (kitchen: Kitchen) => request(app).get(`${API}/chefs/me`).set(bearer(kitchen.accessToken));

describe('The confirm-time promise', () => {
  it('is 4 hours for a new kitchen, and customers see the one the chef picks', async () => {
    const kitchen = await openKitchen();
    expect((await publicProfile(kitchen)).body.data.chef.confirmWithinHours).toBe(4);

    const saved = await saveHours(kitchen, { confirmWithinHours: 12 });

    expect(saved.status).toBe(200);
    expect(saved.body.data.chefProfile.confirmWithinHours).toBe(12);
    expect((await publicProfile(kitchen)).body.data.chef.confirmWithinHours).toBe(12);
  });

  it('stays the same when the hours are saved without it', async () => {
    const kitchen = await openKitchen({ confirmWithinHours: 12 });

    await saveHours(kitchen);

    expect((await ownKitchen(kitchen)).body.data.chefProfile.confirmWithinHours).toBe(12);
  });

  it('can only be 1, 4, 12 or 24 hours', async () => {
    const kitchen = await openKitchen();

    const res = await saveHours(kitchen, { confirmWithinHours: 5 });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toEqual({ confirmWithinHours: 'Choose 1, 4, 12 or 24 hours' });
  });
});
