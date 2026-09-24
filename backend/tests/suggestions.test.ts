import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { API, bearer, openKitchen, signUp } from './helpers.js';

const app = createApp();

const birria = {
  mealName: 'Birria tacos',
  description: 'Slow-cooked beef birria with consommé for dipping, please!',
  dietaryRequirements: ['dairy-free'],
};

function suggest(accessToken: string, chefId: string, body: Record<string, unknown> = birria) {
  return request(app).post(`${API}/chefs/${chefId}/suggestions`).set(bearer(accessToken)).send(body);
}

function vote(accessToken: string, suggestionId: string) {
  return request(app).post(`${API}/suggestions/${suggestionId}/vote`).set(bearer(accessToken));
}

describe('Suggesting a dish', () => {
  it("lets a customer suggest a dish to a chef, counting the suggester's own vote", async () => {
    const kitchen = await openKitchen();
    const customer = await signUp(app);

    const res = await suggest(customer.accessToken, kitchen.chefId);

    expect(res.status).toBe(201);
    expect(res.body.data.suggestion).toMatchObject({
      mealName: 'Birria tacos',
      dietaryRequirements: ['dairy-free'],
      status: 'PENDING',
      votes: 1,
      hasVoted: true,
      suggestedBy: 'Sam R.',
    });
  });

  it('checks the suggestion details', async () => {
    const kitchen = await openKitchen();
    const customer = await signUp(app);

    const res = await suggest(customer.accessToken, kitchen.chefId, { mealName: '', description: 'short' });

    expect(res.status).toBe(422);
    expect(Object.keys(res.body.error.details).sort()).toEqual(['description', 'mealName']);
  });

  it('does not let chefs suggest dishes to their own kitchen', async () => {
    const kitchen = await openKitchen();

    const res = await suggest(kitchen.accessToken, kitchen.chefId);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('OWN_KITCHEN');
  });

  it('allows up to 5 open suggestions per person for each chef', async () => {
    const kitchen = await openKitchen();
    const customer = await signUp(app);
    for (let index = 0; index < 5; index += 1) {
      await suggest(customer.accessToken, kitchen.chefId, { ...birria, mealName: `Dish ${index}` });
    }

    const res = await suggest(customer.accessToken, kitchen.chefId, { ...birria, mealName: 'One too many' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TOO_MANY_SUGGESTIONS');
  });

  it('requires login', async () => {
    const kitchen = await openKitchen();

    const res = await request(app).post(`${API}/chefs/${kitchen.chefId}/suggestions`).send(birria);

    expect(res.status).toBe(401);
  });
});

describe('Voting', () => {
  it('counts each person once and lets them take their vote back', async () => {
    const kitchen = await openKitchen();
    const suggester = await signUp(app);
    const neighbor = await signUp(app);
    const created = await suggest(suggester.accessToken, kitchen.chefId);
    const id = created.body.data.suggestion.id;

    const first = await vote(neighbor.accessToken, id);
    const again = await vote(neighbor.accessToken, id);
    const takenBack = await request(app).delete(`${API}/suggestions/${id}/vote`).set(bearer(neighbor.accessToken));

    expect(first.body.data.suggestion).toMatchObject({ votes: 2, hasVoted: true });
    expect(again.body.data.suggestion).toMatchObject({ votes: 2, hasVoted: true });
    expect(takenBack.body.data.suggestion).toMatchObject({ votes: 1, hasVoted: false });
  });

  it('does not take votes on requests the chef declined', async () => {
    const kitchen = await openKitchen();
    const suggester = await signUp(app);
    const neighbor = await signUp(app);
    const created = await suggest(suggester.accessToken, kitchen.chefId);
    await request(app)
      .put(`${API}/chefs/me/suggestions/${created.body.data.suggestion.id}`)
      .set(bearer(kitchen.accessToken))
      .send({ status: 'DECLINED' });

    const res = await vote(neighbor.accessToken, created.body.data.suggestion.id);

    expect(res.status).toBe(404);
  });

  it("does not let chefs vote on requests for their own kitchen", async () => {
    const kitchen = await openKitchen();
    const customer = await signUp(app);
    const created = await suggest(customer.accessToken, kitchen.chefId);

    const res = await vote(kitchen.accessToken, created.body.data.suggestion.id);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('OWN_KITCHEN');
  });

  it('requires login to vote', async () => {
    const kitchen = await openKitchen();
    const suggester = await signUp(app);
    const created = await suggest(suggester.accessToken, kitchen.chefId);

    const res = await request(app).post(`${API}/suggestions/${created.body.data.suggestion.id}/vote`);

    expect(res.status).toBe(401);
  });
});

describe("A chef's dish requests", () => {
  it('shows open requests on the chef page, most wanted first, without declined ones', async () => {
    const kitchen = await openKitchen();
    const [a, b, c] = [await signUp(app), await signUp(app), await signUp(app)];
    await suggest(a.accessToken, kitchen.chefId, { ...birria, mealName: 'Tamales de mole' });
    const popular = await suggest(a.accessToken, kitchen.chefId, { ...birria, mealName: 'Birria tacos' });
    const declined = await suggest(a.accessToken, kitchen.chefId, { ...birria, mealName: 'Sushi' });
    await vote(b.accessToken, popular.body.data.suggestion.id);
    await vote(c.accessToken, popular.body.data.suggestion.id);
    await request(app)
      .put(`${API}/chefs/me/suggestions/${declined.body.data.suggestion.id}`)
      .set(bearer(kitchen.accessToken))
      .send({ status: 'DECLINED', chefResponse: 'Not my specialty, sorry!' });

    const res = await request(app).get(`${API}/chefs/${kitchen.chefId}/suggestions`).set(bearer(b.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.map((item: { mealName: string }) => item.mealName)).toEqual(['Birria tacos', 'Tamales de mole']);
    expect(res.body.data[0]).toMatchObject({ votes: 3, hasVoted: true });
    expect(res.body.data[1]).toMatchObject({ votes: 1, hasVoted: false });
  });

  it('asks the app to refresh an expired login instead of quietly showing the list logged out', async () => {
    const kitchen = await openKitchen();

    const res = await request(app).get(`${API}/chefs/${kitchen.chefId}/suggestions`).set(bearer('expired-or-made-up'));

    expect(res.status).toBe(401);
  });

  it('lets the chef answer a request and change its status', async () => {
    const kitchen = await openKitchen();
    const customer = await signUp(app);
    const created = await suggest(customer.accessToken, kitchen.chefId);

    const res = await request(app)
      .put(`${API}/chefs/me/suggestions/${created.body.data.suggestion.id}`)
      .set(bearer(kitchen.accessToken))
      .send({ status: 'ACCEPTED', chefResponse: 'Coming next Saturday!' });

    expect(res.status).toBe(200);
    const onPage = await request(app).get(`${API}/chefs/${kitchen.chefId}/suggestions`);
    expect(onPage.body.data[0]).toMatchObject({ status: 'ACCEPTED', chefResponse: 'Coming next Saturday!' });
  });

  it("cannot answer another chef's requests", async () => {
    const kitchen = await openKitchen();
    const otherKitchen = await openKitchen();
    const customer = await signUp(app);
    const created = await suggest(customer.accessToken, kitchen.chefId);

    const res = await request(app)
      .put(`${API}/chefs/me/suggestions/${created.body.data.suggestion.id}`)
      .set(bearer(otherKitchen.accessToken))
      .send({ status: 'DECLINED' });

    expect(res.status).toBe(404);
  });

  it('lists all requests, including declined ones, in the chef dashboard', async () => {
    const kitchen = await openKitchen();
    const customer = await signUp(app);
    const created = await suggest(customer.accessToken, kitchen.chefId);
    await request(app)
      .put(`${API}/chefs/me/suggestions/${created.body.data.suggestion.id}`)
      .set(bearer(kitchen.accessToken))
      .send({ status: 'DECLINED' });

    const res = await request(app).get(`${API}/chefs/me/suggestions`).set(bearer(kitchen.accessToken));

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe('DECLINED');
  });

  it('puts requests still waiting for an answer first in the chef dashboard', async () => {
    const kitchen = await openKitchen();
    const [a, b] = [await signUp(app), await signUp(app)];
    const answered = await suggest(a.accessToken, kitchen.chefId, { ...birria, mealName: 'Birria tacos' });
    await vote(b.accessToken, answered.body.data.suggestion.id);
    await suggest(a.accessToken, kitchen.chefId, { ...birria, mealName: 'Tamales de mole' });
    await request(app)
      .put(`${API}/chefs/me/suggestions/${answered.body.data.suggestion.id}`)
      .set(bearer(kitchen.accessToken))
      .send({ status: 'ACCEPTED' });

    const res = await request(app).get(`${API}/chefs/me/suggestions`).set(bearer(kitchen.accessToken));

    expect(res.body.data.map((item: { mealName: string }) => item.mealName)).toEqual(['Tamales de mole', 'Birria tacos']);
  });
});
