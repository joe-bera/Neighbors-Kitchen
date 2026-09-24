import bcrypt from 'bcrypt';
import request, { Response } from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

const app = createApp();
const API = '/api/v1';

const jane = {
  email: 'Jane.Doe@Example.com',
  password: 'Tacos4ever',
  firstName: 'Jane',
  lastName: 'Doe',
};

function register(overrides: Record<string, unknown> = {}) {
  return request(app).post(`${API}/auth/register`).send({ ...jane, ...overrides });
}

function login(email: string, password: string) {
  return request(app).post(`${API}/auth/login`).send({ email, password });
}

/** The full Set-Cookie header for the refresh token, if the response set one. */
function refreshSetCookie(res: Response): string | undefined {
  return res.get('Set-Cookie')?.find((cookie) => cookie.startsWith('nk_refresh='));
}

/** Just the `name=value` part, ready to send back in a Cookie header. */
function refreshCookie(res: Response): string {
  const setCookie = refreshSetCookie(res);
  if (!setCookie) throw new Error('response did not set a refresh cookie');
  return setCookie.split(';')[0];
}

describe('POST /auth/register', () => {
  it('creates a customer account, returns an access token and sets an httpOnly refresh cookie', async () => {
    const res = await register();

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({
      email: 'jane.doe@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      role: 'CUSTOMER',
    });
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(refreshSetCookie(res)).toMatch(/HttpOnly/i);
  });

  it('creates a chef account when the chef role is chosen', async () => {
    const res = await register({ role: 'CHEF' });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('CHEF');
  });

  it('refuses to create an admin account', async () => {
    const res = await register({ role: 'ADMIN' });

    expect(res.status).toBe(422);
    expect(await prisma.user.count()).toBe(0);
  });

  it('stores a bcrypt hash instead of the password', async () => {
    await register();

    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'jane.doe@example.com' } });
    expect(user.passwordHash).not.toBe(jane.password);
    expect(await bcrypt.compare(jane.password, user.passwordHash)).toBe(true);
  });

  it('reports every invalid field', async () => {
    const res = await register({ email: 'not-an-email', password: 'short', firstName: '', lastName: '' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(res.body.error.details).sort()).toEqual(['email', 'firstName', 'lastName', 'password']);
  });

  it('requires the password to contain a number', async () => {
    const res = await register({ password: 'onlyletters' });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toHaveProperty('password');
  });

  it('rejects an email that is already registered, ignoring case', async () => {
    await register();

    const res = await register({ email: 'JANE.DOE@example.COM' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await register();
  });

  it('logs in with the right password and any capitalization of the email', async () => {
    const res = await login('JANE.doe@example.com', jane.password);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('jane.doe@example.com');
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(refreshSetCookie(res)).toMatch(/HttpOnly/i);
  });

  it('rejects a wrong password', async () => {
    const res = await login(jane.email, 'Wrong-password1');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('gives an unknown email exactly the same answer as a wrong password', async () => {
    const wrongPassword = await login(jane.email, 'Wrong-password1');
    const unknownEmail = await login('nobody@example.com', 'Wrong-password1');

    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });

  it('locks the account for 15 minutes after 5 wrong passwords, even for the right password', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await login(jane.email, 'Wrong-password1');
    }

    const res = await login(jane.email, jane.password);

    expect(res.status).toBe(423);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'jane.doe@example.com' } });
    const lockMs = user.lockedUntil!.getTime() - Date.now();
    expect(lockMs).toBeGreaterThan(14 * 60 * 1000);
    expect(lockMs).toBeLessThanOrEqual(15 * 60 * 1000);
  });

  it('allows login again once the lock has expired', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await login(jane.email, 'Wrong-password1');
    }
    await prisma.user.update({
      where: { email: 'jane.doe@example.com' },
      data: { lockedUntil: new Date(Date.now() - 1000) },
    });

    const res = await login(jane.email, jane.password);

    expect(res.status).toBe(200);
  });

  it('starts counting wrong passwords from zero after a successful login', async () => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await login(jane.email, 'Wrong-password1');
    }
    await login(jane.email, jane.password);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await login(jane.email, 'Wrong-password1');
    }

    const res = await login(jane.email, jane.password);

    expect(res.status).toBe(200);
  });

  it('refuses deactivated accounts', async () => {
    await prisma.user.update({ where: { email: 'jane.doe@example.com' }, data: { isActive: false } });

    const res = await login(jane.email, jane.password);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });
});

describe('POST /auth/refresh-token', () => {
  it('returns a fresh access token and the user for a valid refresh cookie', async () => {
    const signup = await register();

    const res = await request(app).post(`${API}/auth/refresh-token`).set('Cookie', refreshCookie(signup));

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('jane.doe@example.com');
    expect(typeof res.body.data.accessToken).toBe('string');
  });

  it('rejects a request without a refresh cookie', async () => {
    const res = await request(app).post(`${API}/auth/refresh-token`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('rejects a refresh token it never issued', async () => {
    await register();

    const res = await request(app).post(`${API}/auth/refresh-token`).set('Cookie', 'nk_refresh=made-up-token');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('rejects an expired refresh token', async () => {
    const signup = await register();
    await prisma.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await request(app).post(`${API}/auth/refresh-token`).set('Cookie', refreshCookie(signup));

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('stops working once the account is deactivated', async () => {
    const signup = await register();
    await prisma.user.update({ where: { email: 'jane.doe@example.com' }, data: { isActive: false } });

    const res = await request(app).post(`${API}/auth/refresh-token`).set('Cookie', refreshCookie(signup));

    expect(res.status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('revokes the refresh token and clears the cookie', async () => {
    const signup = await register();
    const cookie = refreshCookie(signup);

    const res = await request(app).post(`${API}/auth/logout`).set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(refreshSetCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
    const retry = await request(app).post(`${API}/auth/refresh-token`).set('Cookie', cookie);
    expect(retry.status).toBe(401);
  });
});
