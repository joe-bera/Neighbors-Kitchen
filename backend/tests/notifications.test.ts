import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { API, bearer, signUp } from './helpers.js';

const app = createApp();

function notice(userId: string, title: string, minutesAgo: number, read = false) {
  const createdAt = new Date(Date.now() - minutesAgo * 60 * 1000);
  return prisma.notification.create({
    data: { userId, kind: 'ORDER_CONFIRMED', title, body: null, link: '/orders/x', createdAt, readAt: read ? createdAt : null },
  });
}

const list = (accessToken: string, query = '') => request(app).get(`${API}/notifications${query}`).set(bearer(accessToken));
const unread = (accessToken: string) => request(app).get(`${API}/notifications/unread-count`).set(bearer(accessToken));

describe('GET /notifications', () => {
  it('lists my notifications newest first, with how many are unread', async () => {
    const me = await signUp(app);
    await notice(me.userId, 'Oldest', 30, true);
    await notice(me.userId, 'Newest', 1);
    await notice(me.userId, 'Middle', 10);

    const res = await list(me.accessToken);

    expect(res.status).toBe(200);
    expect(res.body.data.unreadCount).toBe(2);
    expect(res.body.data.notifications.map((item: { title: string; read: boolean }) => [item.title, item.read])).toEqual([
      ['Newest', false],
      ['Middle', false],
      ['Oldest', true],
    ]);
    expect(Object.keys(res.body.data.notifications[0]).sort()).toEqual(['body', 'createdAt', 'id', 'kind', 'link', 'read', 'title']);
  });

  it("never shows someone else's notifications", async () => {
    const me = await signUp(app);
    const someoneElse = await signUp(app);
    await notice(someoneElse.userId, 'Not mine', 1);

    const res = await list(me.accessToken);

    expect(res.body.data).toEqual({ notifications: [], unreadCount: 0 });
  });

  it('returns at most `limit` notifications, from 1 to 50', async () => {
    const me = await signUp(app);
    for (const minutes of [1, 2, 3]) await notice(me.userId, `Notice ${minutes}`, minutes);

    expect((await list(me.accessToken, '?limit=2')).body.data.notifications).toHaveLength(2);
    expect((await list(me.accessToken, '?limit=0')).status).toBe(422);
    expect((await list(me.accessToken, '?limit=51')).status).toBe(422);
  });

  it('requires login', async () => {
    expect((await request(app).get(`${API}/notifications`)).status).toBe(401);
  });
});

describe('GET /notifications/unread-count', () => {
  it('counts only my unread notifications', async () => {
    const me = await signUp(app);
    const someoneElse = await signUp(app);
    await notice(me.userId, 'Unread', 1);
    await notice(me.userId, 'Read', 2, true);
    await notice(someoneElse.userId, 'Not mine', 1);

    const res = await unread(me.accessToken);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ unreadCount: 1 });
  });
});

describe('POST /notifications/read-all', () => {
  it('marks all of my notifications read, and nobody else\'s', async () => {
    const me = await signUp(app);
    const someoneElse = await signUp(app);
    await notice(me.userId, 'One', 1);
    await notice(me.userId, 'Two', 2);
    await notice(someoneElse.userId, 'Not mine', 1);

    const res = await request(app).post(`${API}/notifications/read-all`).set(bearer(me.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ unreadCount: 0 });
    expect((await unread(me.accessToken)).body.data.unreadCount).toBe(0);
    expect((await unread(someoneElse.accessToken)).body.data.unreadCount).toBe(1);
  });
});
