import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { API, bearer, signUp } from './helpers.js';

const app = createApp();

const save = (accessToken: string, body: Record<string, unknown>) =>
  request(app).put(`${API}/users/me/email-settings`).set(bearer(accessToken)).send(body);

describe('Email settings', () => {
  it('are all on for a new account', async () => {
    const me = await signUp(app);

    const res = await request(app).get(`${API}/users/me`).set(bearer(me.accessToken));

    expect(res.body.data.user.emailSettings).toEqual({ rateReminders: true, dishRequestNews: true, kitchenFeedback: true });
  });

  it('change only the switches sent', async () => {
    const me = await signUp(app);

    const res = await save(me.accessToken, { rateReminders: false });

    expect(res.status).toBe(200);
    expect(res.body.data.emailSettings).toEqual({ rateReminders: false, dishRequestNews: true, kitchenFeedback: true });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: me.userId } });
    expect([user.emailRateReminders, user.emailDishRequestNews, user.emailKitchenFeedback]).toEqual([false, true, true]);
  });

  it('need at least one on/off value', async () => {
    const me = await signUp(app);

    expect((await save(me.accessToken, {})).status).toBe(422);
    expect((await save(me.accessToken, { rateReminders: 'no' })).status).toBe(422);
  });

  it('require login', async () => {
    expect((await request(app).put(`${API}/users/me/email-settings`).send({ rateReminders: false })).status).toBe(401);
  });
});
