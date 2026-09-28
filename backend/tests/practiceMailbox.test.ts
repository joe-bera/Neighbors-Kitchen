import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { practiceMailboxEnabled } from '../src/services/notifications/mailer.js';
import { API } from './helpers.js';

const app = createApp();

async function someone() {
  return prisma.user.create({ data: { email: 'dana@example.com', passwordHash: 'not-a-real-hash', firstName: 'Dana', lastName: 'Kim' } });
}

describe('Practice mailbox', () => {
  it('lists the latest emails, newest first, without their contents', async () => {
    const dana = await someone();
    await prisma.email.create({
      data: { userId: dana.id, toAddress: 'dana@example.com', kind: 'ORDER_PLACED', data: {}, status: 'SENT', subject: 'Older email', createdAt: new Date(Date.now() - 60 * 1000) },
    });
    await prisma.email.create({ data: { userId: dana.id, toAddress: 'dana@example.com', kind: 'NEW_ORDER', data: {} } });

    const res = await request(app).get(`${API}/dev/emails`);

    expect(res.status).toBe(200);
    expect(res.body.data.emails).toMatchObject([
      { to: 'dana@example.com', kind: 'NEW_ORDER', subject: null, status: 'PENDING', attempts: 0, lastError: null, sentAt: null },
      { to: 'dana@example.com', kind: 'ORDER_PLACED', subject: 'Older email', status: 'SENT' },
    ]);
    expect(res.body.data.emails[0]).not.toHaveProperty('html');
  });

  it('shows one email as it was written', async () => {
    const dana = await someone();
    const email = await prisma.email.create({
      data: { userId: dana.id, toAddress: 'dana@example.com', kind: 'ORDER_PLACED', data: {}, status: 'SENT', subject: 'Hello', html: '<p>Hello</p>', textBody: 'Hello' },
    });

    const res = await request(app).get(`${API}/dev/emails/${email.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toMatchObject({ id: email.id, subject: 'Hello', html: '<p>Hello</p>', text: 'Hello' });
  });

  it('answers 404 for an email that does not exist', async () => {
    const res = await request(app).get(`${API}/dev/emails/no-such-email`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('is switched off in production', () => {
    expect(practiceMailboxEnabled({ EMAIL_TRANSPORT: 'mailbox', NODE_ENV: 'production' })).toBe(false);
    expect(practiceMailboxEnabled({ EMAIL_TRANSPORT: 'mailbox', NODE_ENV: 'development' })).toBe(true);
  });
});
