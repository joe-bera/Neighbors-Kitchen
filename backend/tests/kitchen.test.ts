import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { API, bearer, kitchenInput, signUp, signUpChefWithKitchen } from './helpers.js';

const app = createApp();

describe('POST /chefs (become a chef)', () => {
  it('turns a customer into a chef with a kitchen profile and an empty menu', async () => {
    const customer = await signUp(app, 'CUSTOMER');

    const res = await request(app).post(`${API}/chefs`).set(bearer(customer.accessToken)).send(kitchenInput);

    expect(res.status).toBe(201);
    expect(res.body.data.chefProfile).toMatchObject({
      kitchenName: "Sam's Kitchen",
      addressLine1: '742 Evergreen Terrace',
      addressLine2: null,
      city: 'Redlands',
      state: 'CA',
      zipCode: '92373',
      serviceRadiusMiles: 10,
      isAcceptingOrders: true,
      availability: [],
      orderLeadTimeHours: 24,
      offersPickup: true,
      offersDelivery: false,
      mealCount: 0,
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: customer.userId } });
    expect(user.role).toBe('CHEF');
    expect(await prisma.menu.count({ where: { chef: { userId: customer.userId } } })).toBe(1);
  });

  it('gives the new chef an access token with the chef role after refreshing', async () => {
    const customer = await signUp(app, 'CUSTOMER');
    await request(app).post(`${API}/chefs`).set(bearer(customer.accessToken)).send(kitchenInput);

    const refreshed = await request(app).post(`${API}/auth/refresh-token`).set('Cookie', customer.refreshCookie);
    const myKitchen = await request(app).get(`${API}/chefs/me`).set(bearer(refreshed.body.data.accessToken));

    expect(refreshed.body.data.user.role).toBe('CHEF');
    expect(myKitchen.status).toBe(200);
  });

  it('lets someone who signed up as a chef finish setting up their kitchen', async () => {
    const chef = await signUp(app, 'CHEF');

    const res = await request(app).post(`${API}/chefs`).set(bearer(chef.accessToken)).send(kitchenInput);

    expect(res.status).toBe(201);
  });

  it('refuses a second kitchen for the same account', async () => {
    const chef = await signUpChefWithKitchen(app);

    const res = await request(app).post(`${API}/chefs`).set(bearer(chef.accessToken)).send(kitchenInput);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_CHEF');
  });

  it('checks the profile and address fields', async () => {
    const customer = await signUp(app);

    const res = await request(app)
      .post(`${API}/chefs`)
      .set(bearer(customer.accessToken))
      .send({ ...kitchenInput, bio: 'Too short', specialties: [], state: 'California', zipCode: 'abc' });

    expect(res.status).toBe(422);
    expect(Object.keys(res.body.error.details).sort()).toEqual(['bio', 'specialties', 'state', 'zipCode']);
  });

  it('requires a logged-in user', async () => {
    const res = await request(app).post(`${API}/chefs`).send(kitchenInput);

    expect(res.status).toBe(401);
  });
});

describe('GET /chefs/me', () => {
  it('shows the owner their full kitchen profile, including the private address', async () => {
    const chef = await signUpChefWithKitchen(app);

    const res = await request(app).get(`${API}/chefs/me`).set(bearer(chef.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.chefProfile).toMatchObject({ id: chef.chefId, addressLine1: '742 Evergreen Terrace', zipCode: '92373' });
  });

  it('tells a chef who has not set up a kitchen yet', async () => {
    const chef = await signUp(app, 'CHEF');

    const res = await request(app).get(`${API}/chefs/me`).set(bearer(chef.accessToken));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NO_CHEF_PROFILE');
  });

  it('is only for chefs', async () => {
    const customer = await signUp(app, 'CUSTOMER');

    const res = await request(app).get(`${API}/chefs/me`).set(bearer(customer.accessToken));

    expect(res.status).toBe(403);
  });
});

describe('PUT /chefs/me', () => {
  it('changes only the fields that are sent, including pausing new orders', async () => {
    const chef = await signUpChefWithKitchen(app);

    const res = await request(app)
      .put(`${API}/chefs/me`)
      .set(bearer(chef.accessToken))
      .send({ bio: 'Now cooking Oaxacan moles every weekend for the neighborhood.', isAcceptingOrders: false });

    expect(res.status).toBe(200);
    expect(res.body.data.chefProfile).toMatchObject({
      bio: 'Now cooking Oaxacan moles every weekend for the neighborhood.',
      isAcceptingOrders: false,
      kitchenName: "Sam's Kitchen",
      certifications: ['California Food Handler Card'],
    });
  });
});

describe('PUT /chefs/me/availability', () => {
  const weeknights = {
    schedule: [
      { dayOfWeek: 4, startTime: '17:00', endTime: '20:00' },
      { dayOfWeek: 2, startTime: '16:30', endTime: '19:00' },
    ],
    orderLeadTimeHours: 48,
    offersPickup: true,
    offersDelivery: true,
    deliveryFee: 4.5,
  };

  it('saves the weekly hours and how food is handed over', async () => {
    const chef = await signUpChefWithKitchen(app);

    const res = await request(app).put(`${API}/chefs/me/availability`).set(bearer(chef.accessToken)).send(weeknights);

    expect(res.status).toBe(200);
    expect(res.body.data.chefProfile).toMatchObject({
      availability: [
        { dayOfWeek: 2, startTime: '16:30', endTime: '19:00' },
        { dayOfWeek: 4, startTime: '17:00', endTime: '20:00' },
      ],
      orderLeadTimeHours: 48,
      offersPickup: true,
      offersDelivery: true,
      deliveryFee: 4.5,
    });
  });

  it('replaces the previous schedule instead of adding to it', async () => {
    const chef = await signUpChefWithKitchen(app);
    await request(app).put(`${API}/chefs/me/availability`).set(bearer(chef.accessToken)).send(weeknights);

    const res = await request(app)
      .put(`${API}/chefs/me/availability`)
      .set(bearer(chef.accessToken))
      .send({ ...weeknights, schedule: [{ dayOfWeek: 6, startTime: '10:00', endTime: '14:00' }] });

    expect(res.body.data.chefProfile.availability).toEqual([{ dayOfWeek: 6, startTime: '10:00', endTime: '14:00' }]);
  });

  it('rejects hours that end before they start', async () => {
    const chef = await signUpChefWithKitchen(app);

    const res = await request(app)
      .put(`${API}/chefs/me/availability`)
      .set(bearer(chef.accessToken))
      .send({ ...weeknights, schedule: [{ dayOfWeek: 1, startTime: '18:00', endTime: '17:00' }] });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toHaveProperty(['schedule.0.endTime']);
  });

  it('rejects the same day listed twice', async () => {
    const chef = await signUpChefWithKitchen(app);
    const monday = { dayOfWeek: 1, startTime: '10:00', endTime: '12:00' };

    const res = await request(app)
      .put(`${API}/chefs/me/availability`)
      .set(bearer(chef.accessToken))
      .send({ ...weeknights, schedule: [monday, monday] });

    expect(res.status).toBe(422);
  });

  it('requires pickup, delivery, or both', async () => {
    const chef = await signUpChefWithKitchen(app);

    const res = await request(app)
      .put(`${API}/chefs/me/availability`)
      .set(bearer(chef.accessToken))
      .send({ ...weeknights, offersPickup: false, offersDelivery: false });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toHaveProperty('offersPickup');
  });

  it('shows the hours and delivery options on the public chef profile', async () => {
    const chef = await signUpChefWithKitchen(app);
    await request(app).put(`${API}/chefs/me/availability`).set(bearer(chef.accessToken)).send(weeknights);

    const res = await request(app).get(`${API}/chefs/${chef.chefId}`);

    expect(res.body.data.chef).toMatchObject({
      availability: [
        { dayOfWeek: 2, startTime: '16:30', endTime: '19:00' },
        { dayOfWeek: 4, startTime: '17:00', endTime: '20:00' },
      ],
      orderLeadTimeHours: 48,
      offersDelivery: true,
      deliveryFee: 4.5,
    });
  });
});
