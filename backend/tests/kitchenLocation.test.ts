import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { distanceMiles } from '../src/services/geo.js';
import { geocodeAddress } from '../src/services/geocoding.js';
import { zipCentroid } from '../src/services/zipCodes.js';
import { API, bearer, kitchenInput, signUp, signUpChefWithKitchen } from './helpers.js';

vi.mock('../src/services/geocoding.js', () => ({ geocodeAddress: vi.fn() }));
const geocode = vi.mocked(geocodeAddress);

const app = createApp();
const CITY_HALL = { latitude: 34.055217, longitude: -117.182488 };
const PALM_SPRINGS = { latitude: 33.8303, longitude: -116.5453 };

beforeEach(() => {
  geocode.mockReset();
  geocode.mockResolvedValue(null);
});

/** What is stored for the user's kitchen: the exact position and the public area center. */
async function storedLocation(userId: string) {
  const chef = await prisma.chefProfile.findUniqueOrThrow({ where: { userId } });
  const point = (lat: typeof chef.latitude, lng: typeof chef.longitude) =>
    lat && lng ? { latitude: lat.toNumber(), longitude: lng.toNumber() } : null;
  return { exact: point(chef.latitude, chef.longitude), area: point(chef.approxLatitude, chef.approxLongitude) };
}

describe('Placing a kitchen on the map', () => {
  it('finds a new kitchen at its street address and shows the chef only the approximate area', async () => {
    geocode.mockResolvedValue(CITY_HALL);
    const customer = await signUp(app);

    const res = await request(app).post(`${API}/chefs`).set(bearer(customer.accessToken)).send(kitchenInput);

    expect(res.status).toBe(201);
    expect(geocode).toHaveBeenCalledWith('742 Evergreen Terrace, Redlands, CA 92373');
    const { exact, area } = await storedLocation(customer.userId);
    expect(exact).toEqual(CITY_HALL);
    const offset = distanceMiles(exact!, area!);
    expect(offset).toBeGreaterThanOrEqual(0.099);
    expect(offset).toBeLessThanOrEqual(0.301);
    expect(res.body.data.chefProfile.area).toEqual({ ...area, radiusMiles: 0.5 });
    expect(res.body.data.chefProfile).not.toHaveProperty('latitude');
    expect(res.body.data.chefProfile).not.toHaveProperty('longitude');
    expect(res.body.data.chefProfile).not.toHaveProperty('approxLatitude');
  });

  it('uses the middle of the ZIP code when the street address is not found', async () => {
    const customer = await signUp(app);

    await request(app).post(`${API}/chefs`).set(bearer(customer.accessToken)).send(kitchenInput);

    expect((await storedLocation(customer.userId)).exact).toEqual(zipCentroid('92373'));
  });

  it('leaves a kitchen off the map when neither the address nor the ZIP code can be found', async () => {
    const customer = await signUp(app);

    const res = await request(app)
      .post(`${API}/chefs`)
      .set(bearer(customer.accessToken))
      .send({ ...kitchenInput, zipCode: '00000' });

    expect(res.status).toBe(201);
    expect(res.body.data.chefProfile.area).toBeNull();
    expect(await storedLocation(customer.userId)).toEqual({ exact: null, area: null });
  });

  it('finds the kitchen again when the address changes', async () => {
    const chef = await signUpChefWithKitchen(app);
    const before = await storedLocation(chef.userId);
    geocode.mockResolvedValue(PALM_SPRINGS);

    const res = await request(app)
      .put(`${API}/chefs/me`)
      .set(bearer(chef.accessToken))
      .send({ addressLine1: '300 N Palm Canyon Dr', city: 'Palm Springs', zipCode: '92262' });

    expect(res.status).toBe(200);
    expect(geocode).toHaveBeenLastCalledWith('300 N Palm Canyon Dr, Palm Springs, CA 92262');
    const after = await storedLocation(chef.userId);
    expect(after.exact).toEqual(PALM_SPRINGS);
    expect(after.area).not.toEqual(before.area);
    expect(res.body.data.chefProfile.area).toEqual({ ...after.area, radiusMiles: 0.5 });
  });

  it('keeps the same area when the apartment line or other details change, or the same address is saved again', async () => {
    const chef = await signUpChefWithKitchen(app);
    const before = await storedLocation(chef.userId);
    geocode.mockClear();

    await request(app)
      .put(`${API}/chefs/me`)
      .set(bearer(chef.accessToken))
      .send({
        bio: 'Now cooking Oaxacan moles every weekend for the neighborhood.',
        addressLine2: 'Unit B',
        addressLine1: '742 Evergreen Terrace',
        city: 'Redlands',
      });

    expect(geocode).not.toHaveBeenCalled();
    expect(await storedLocation(chef.userId)).toEqual(before);
  });
});
