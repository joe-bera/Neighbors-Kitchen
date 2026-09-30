import crypto from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { API } from './helpers.js';
import { emailsFor } from './notificationHelpers.js';

const app = createApp();
const MINUTE = 60 * 1000;
const ANSWER = "If there's an account for that email, we sent a link to reset the password.";

async function register() {
  const res = await request(app)
    .post(`${API}/auth/register`)
    .send({ email: 'jane@example.com', password: 'Tacos4ever', firstName: 'Jane', lastName: 'Doe' });
  expect(res.status).toBe(201);
  const refreshCookie = res.get('Set-Cookie')!.find((cookie) => cookie.startsWith('nk_refresh='))!.split(';')[0];
  return { userId: res.body.data.user.id as string, refreshCookie };
}

const forgot = (email: string) => request(app).post(`${API}/auth/forgot-password`).send({ email });
const reset = (token: string, password: string) => request(app).post(`${API}/auth/reset-password`).send({ token, password });
const login = (password: string) => request(app).post(`${API}/auth/login`).send({ email: 'jane@example.com', password });

/** The token in the newest reset email sent to the user. */
async function latestToken(userId: string) {
  const resets = (await emailsFor(userId)).filter((email) => email.kind === 'PASSWORD_RESET');
  return (resets.at(-1)!.data as { token: string }).token;
}

describe('POST /auth/forgot-password', () => {
  it('emails a one-hour reset link to an account that exists, and stores only its hash', async () => {
    const jane = await register();
    const before = Date.now();

    const res = await forgot('Jane@Example.com');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: ANSWER });
    const [email] = await emailsFor(jane.userId);
    expect(email).toMatchObject({ kind: 'PASSWORD_RESET', toAddress: 'jane@example.com', data: { firstName: 'Jane' } });
    const token = (email.data as { token: string }).token;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: jane.userId } });
    expect(user.passwordResetToken).toBe(crypto.createHash('sha256').update(token).digest('hex'));
    expect(user.passwordResetExpires!.getTime()).toBeGreaterThanOrEqual(before + 60 * MINUTE);
    expect(user.passwordResetExpires!.getTime()).toBeLessThanOrEqual(Date.now() + 60 * MINUTE);
  });

  it('gives the same answer for an unknown email, and sends nothing', async () => {
    const res = await forgot('nobody@example.com');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(ANSWER);
    expect(await prisma.email.count()).toBe(0);
  });

  it('sends nothing to a deactivated account', async () => {
    const jane = await register();
    await prisma.user.update({ where: { id: jane.userId }, data: { isActive: false } });

    expect((await forgot('jane@example.com')).body.message).toBe(ANSWER);
    expect(await emailsFor(jane.userId)).toEqual([]);
  });

  it('sends at most one email every 2 minutes, and a newer link replaces the older one', async () => {
    const jane = await register();
    await forgot('jane@example.com');
    const first = await latestToken(jane.userId);

    await forgot('jane@example.com');
    expect((await emailsFor(jane.userId)).filter((email) => email.kind === 'PASSWORD_RESET')).toHaveLength(1);

    // As if the first link had been sent 3 minutes ago.
    await prisma.user.update({ where: { id: jane.userId }, data: { passwordResetExpires: new Date(Date.now() + 57 * MINUTE) } });
    await forgot('jane@example.com');
    const second = await latestToken(jane.userId);

    expect(second).not.toBe(first);
    expect((await reset(first, 'NewTacos5')).status).toBe(400);
    expect((await reset(second, 'NewTacos5')).status).toBe(200);
  });

  it('sends one email even when many requests arrive at once, and its link is the one that works', async () => {
    const jane = await register();

    const answers = await Promise.all(Array.from({ length: 10 }, () => forgot('jane@example.com')));

    expect(answers.map((res) => res.status)).toEqual([200, 200, 200, 200, 200, 200, 200, 200, 200, 200]);
    const resets = (await emailsFor(jane.userId)).filter((email) => email.kind === 'PASSWORD_RESET');
    expect(resets).toHaveLength(1);
    const token = (resets[0].data as { token: string }).token;
    const user = await prisma.user.findUniqueOrThrow({ where: { id: jane.userId } });
    expect(user.passwordResetToken).toBe(crypto.createHash('sha256').update(token).digest('hex'));
  });

  it('checks the email address', async () => {
    expect((await forgot('not-an-email')).status).toBe(422);
  });
});

describe('POST /auth/reset-password', () => {
  it('signs out the browser it was saved in, even if another account was signed in there', async () => {
    const jane = await register();
    await forgot('jane@example.com');

    const res = await request(app)
      .post(`${API}/auth/reset-password`)
      .set('Cookie', jane.refreshCookie)
      .send({ token: await latestToken(jane.userId), password: 'NewTacos5' });

    expect(res.status).toBe(200);
    expect(res.get('Set-Cookie')).toEqual([expect.stringMatching(/^nk_refresh=; Path=\/api\/v1\/auth; Expires=Thu, 01 Jan 1970 00:00:00 GMT/)]);
  });

  it('sets the new password, and the link works only once', async () => {
    const jane = await register();
    await forgot('jane@example.com');
    const token = await latestToken(jane.userId);

    const res = await reset(token, 'NewTacos5');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Your password was changed. Log in with your new password.');
    expect((await login('NewTacos5')).status).toBe(200);
    expect((await login('Tacos4ever')).status).toBe(401);
    const again = await reset(token, 'OtherTacos6');
    expect(again.status).toBe(400);
    expect(again.body.error).toEqual({ code: 'INVALID_RESET_LINK', message: 'This link has expired or was already used. Ask for a new one.' });
  });

  it('logs out every session, unlocks the account and sends a password-changed email', async () => {
    const jane = await register();
    await prisma.user.update({ where: { id: jane.userId }, data: { failedLoginAttempts: 3, lockedUntil: new Date(Date.now() + 10 * MINUTE) } });
    await forgot('jane@example.com');

    await reset(await latestToken(jane.userId), 'NewTacos5');

    const refreshed = await request(app).post(`${API}/auth/refresh-token`).set('Cookie', jane.refreshCookie);
    expect(refreshed.status).toBe(401);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: jane.userId } })).toMatchObject({
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordResetToken: null,
      passwordResetExpires: null,
    });
    expect((await emailsFor(jane.userId)).map((email) => email.kind)).toEqual(['PASSWORD_RESET', 'PASSWORD_CHANGED']);
  });

  it('refuses an expired link', async () => {
    const jane = await register();
    await forgot('jane@example.com');
    await prisma.user.update({ where: { id: jane.userId }, data: { passwordResetExpires: new Date(Date.now() - MINUTE) } });

    expect((await reset(await latestToken(jane.userId), 'NewTacos5')).status).toBe(400);
  });

  it('refuses a made-up link', async () => {
    expect((await reset('x'.repeat(43), 'NewTacos5')).status).toBe(400);
  });

  it('checks the new password like sign-up does', async () => {
    const jane = await register();
    await forgot('jane@example.com');

    const res = await reset(await latestToken(jane.userId), 'short');

    expect(res.status).toBe(422);
    expect(res.body.error.details.password).toBe('Password must be at least 8 characters');
  });
});
