import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { MILES_PER_DEGREE_LATITUDE } from '../src/services/geo.js';
import { geocodeAddress } from '../src/services/geocoding.js';
import { API, bearer, type Kitchen, openKitchen, pickupOrder, placeOrder, signUp } from './helpers.js';

vi.mock('../src/services/geocoding.js', () => ({ geocodeAddress: vi.fn() }));
const geocode = vi.mocked(geocodeAddress);

const app = createApp();
const ADDRESS = '1 Orange St, Redlands, CA 92373';
// Where the test kitchen's street address is found.
const KITCHEN_SPOT = { latitude: 34.055217, longitude: -117.182488 };

beforeEach(() => {
  geocode.mockReset();
  geocode.mockResolvedValue(null);
});

/** A spot `miles` due north of the kitchen's public area center. */
async function northOfKitchen(kitchen: Kitchen, miles: number) {
  const chef = await prisma.chefProfile.findUniqueOrThrow({ where: { id: kitchen.chefId } });
  return {
    latitude: chef.approxLatitude!.toNumber() + miles / MILES_PER_DEGREE_LATITUDE,
    longitude: chef.approxLongitude!.toNumber(),
  };
}

/** A delivering kitchen placed on the map from its street address. */
async function locatedKitchen() {
  geocode.mockResolvedValueOnce(KITCHEN_SPOT);
  return openKitchen({ offersDelivery: true });
}

function deliveryOrder(kitchen: Kitchen) {
  return { ...pickupOrder(kitchen), pickupOrDelivery: 'DELIVERY', deliveryAddress: ADDRESS, contactPhone: '(909) 555-0142' };
}

async function chefOrders(kitchen: Kitchen) {
  const res = await request(app).get(`${API}/chefs/me/orders`).set(bearer(kitchen.accessToken));
  return res.body.data;
}

// Test kitchens deliver up to 10 miles (helpers.kitchenInput).
describe('Delivery distance', () => {
  it('refuses a delivery address beyond how far the chef delivers', async () => {
    const kitchen = await locatedKitchen();
    const customer = await signUp(app);
    geocode.mockResolvedValueOnce(await northOfKitchen(kitchen, 12.4));

    const res = await placeOrder(customer.accessToken, deliveryOrder(kitchen));

    const message =
      "Sam's Kitchen delivers up to 10 miles from their kitchen. This address is about 12.4 miles away. Please choose pickup or another address.";
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({ code: 'OUTSIDE_DELIVERY_AREA', message, details: { deliveryAddress: message } });
    expect(geocode).toHaveBeenLastCalledWith(ADDRESS);
    expect(await prisma.order.count()).toBe(0);
  });

  it('accepts an address right at the limit and tells only the chef how far it is', async () => {
    const kitchen = await locatedKitchen();
    const customer = await signUp(app);
    geocode.mockResolvedValueOnce(await northOfKitchen(kitchen, 10));

    const res = await placeOrder(customer.accessToken, deliveryOrder(kitchen));

    expect(res.status).toBe(201);
    expect(res.body.data.order).not.toHaveProperty('deliveryDistanceMiles');
    expect((await chefOrders(kitchen))[0].deliveryDistanceMiles).toBe(10);
  });

  it('refuses an address just past the limit', async () => {
    const kitchen = await locatedKitchen();
    const customer = await signUp(app);
    geocode.mockResolvedValueOnce(await northOfKitchen(kitchen, 10.2));

    const res = await placeOrder(customer.accessToken, deliveryOrder(kitchen));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('OUTSIDE_DELIVERY_AREA');
  });

  it('lets the order through when the address cannot be found', async () => {
    const kitchen = await locatedKitchen();
    const customer = await signUp(app);

    const res = await placeOrder(customer.accessToken, deliveryOrder(kitchen));

    expect(res.status).toBe(201);
    expect((await chefOrders(kitchen))[0].deliveryDistanceMiles).toBeNull();
  });

  it('does not look up addresses for pickup orders', async () => {
    const kitchen = await locatedKitchen();
    const customer = await signUp(app);
    geocode.mockClear();

    const res = await placeOrder(customer.accessToken, pickupOrder(kitchen));

    expect(res.status).toBe(201);
    expect(geocode).not.toHaveBeenCalled();
    expect((await chefOrders(kitchen))[0].deliveryDistanceMiles).toBeNull();
  });

  it('skips the check for a kitchen that is not on the map', async () => {
    const kitchen = await locatedKitchen();
    await prisma.chefProfile.update({ where: { id: kitchen.chefId }, data: { approxLatitude: null, approxLongitude: null } });
    const customer = await signUp(app);
    geocode.mockClear();

    const res = await placeOrder(customer.accessToken, deliveryOrder(kitchen));

    expect(res.status).toBe(201);
    expect(geocode).not.toHaveBeenCalled();
  });

  it('skips the check for a kitchen placed only by its ZIP code, whose true spot could be miles away', async () => {
    const kitchen = await openKitchen({ offersDelivery: true });
    const customer = await signUp(app);
    geocode.mockClear();
    geocode.mockResolvedValue({ latitude: 33.7204, longitude: -116.372 });

    const res = await placeOrder(customer.accessToken, deliveryOrder(kitchen));

    expect(res.status).toBe(201);
    expect(geocode).not.toHaveBeenCalled();
    expect((await chefOrders(kitchen))[0].deliveryDistanceMiles).toBeNull();
  });
});
