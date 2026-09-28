import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { deliverDueEmails } from '../src/services/notifications/emailDelivery.js';
import { EmailTransport, OutgoingEmail } from '../src/services/notifications/mailer.js';
import { sampleOrder } from './noticeFixtures.js';

const MINUTE = 60 * 1000;
const NOW = new Date('2026-09-29T20:00:00.000Z');
let sequence = 0;

/** A stand-in for an email service that records what it was asked to send. */
function recordingTransport(keepsCopies = true) {
  const sent: OutgoingEmail[] = [];
  const transport: EmailTransport = {
    keepsCopies,
    send: async (email) => {
      sent.push(email);
    },
  };
  return { sent, transport };
}

const brokenTransport: EmailTransport = {
  keepsCopies: true,
  send: async () => {
    throw new Error('service unavailable');
  },
};

async function queueEmail(overrides: Partial<Prisma.EmailUncheckedCreateInput> = {}) {
  sequence += 1;
  const user = await prisma.user.create({
    data: { email: `mail${sequence}@example.com`, passwordHash: 'not-a-real-hash', firstName: 'Dana', lastName: 'Kim' },
  });
  return prisma.email.create({
    data: {
      userId: user.id,
      toAddress: 'dana@example.com',
      kind: 'ORDER_CONFIRMED',
      data: sampleOrder as unknown as Prisma.InputJsonValue,
      sendAfter: NOW,
      ...overrides,
    },
  });
}

const reload = (id: string) => prisma.email.findUniqueOrThrow({ where: { id } });

describe('deliverDueEmails', () => {
  it('writes and sends due emails, keeping them for the practice mailbox', async () => {
    const email = await queueEmail();
    const { sent, transport } = recordingTransport();

    expect(await deliverDueEmails(NOW, transport)).toEqual({ sent: 1, failed: 0 });

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      to: 'dana@example.com',
      from: 'Neighbors Kitchen <no-reply@neighborskitchen.test>',
      subject: "Abuela's Table confirmed your order NK-7QX4PD",
    });
    const row = await reload(email.id);
    expect(row).toMatchObject({
      status: 'SENT',
      attempts: 1,
      sentAt: NOW,
      lastError: null,
      subject: "Abuela's Table confirmed your order NK-7QX4PD",
    });
    expect(row.html).toContain('View your order');
    expect(row.textBody).toContain('View your order');
  });

  it('leaves emails that are not due yet', async () => {
    await queueEmail({ sendAfter: new Date(NOW.getTime() + MINUTE) });
    const { sent, transport } = recordingTransport();

    expect(await deliverDueEmails(NOW, transport)).toEqual({ sent: 0, failed: 0 });
    expect(sent).toEqual([]);
  });

  it('tries again after 1, 5, 30 and 120 minutes, then gives up', async () => {
    const email = await queueEmail();
    let now = NOW;
    const waits: number[] = [];

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      expect(await deliverDueEmails(now, brokenTransport)).toEqual({ sent: 0, failed: 0 });
      const row = await reload(email.id);
      expect(row).toMatchObject({ status: 'PENDING', attempts: attempt, lastError: 'service unavailable' });
      waits.push((row.sendAfter.getTime() - now.getTime()) / MINUTE);
      now = row.sendAfter;
    }

    expect(waits).toEqual([1, 5, 30, 120]);
    expect(await deliverDueEmails(now, brokenTransport)).toEqual({ sent: 0, failed: 1 });
    expect(await reload(email.id)).toMatchObject({ status: 'FAILED', attempts: 5, lastError: 'service unavailable' });
  });

  it('fails an email it cannot write, without sending it', async () => {
    const email = await queueEmail({ data: {} });
    const { sent, transport } = recordingTransport();

    expect(await deliverDueEmails(NOW, transport)).toEqual({ sent: 0, failed: 1 });

    expect(sent).toEqual([]);
    const row = await reload(email.id);
    expect(row).toMatchObject({ status: 'FAILED', attempts: 1 });
    expect(row.lastError?.startsWith('Could not write this email: ')).toBe(true);
  });

  it('picks up an email left half-sent by a crash, but not one still being sent', async () => {
    const stuck = await queueEmail({ status: 'SENDING', attempts: 1, updatedAt: new Date(NOW.getTime() - 11 * MINUTE) });
    const busy = await queueEmail({ status: 'SENDING', attempts: 1, updatedAt: new Date(NOW.getTime() - 5 * MINUTE) });
    const { sent, transport } = recordingTransport();

    await deliverDueEmails(NOW, transport);

    expect(sent).toHaveLength(1);
    expect((await reload(stuck.id)).status).toBe('SENT');
    expect((await reload(busy.id)).status).toBe('SENDING');
  });

  it('sends an email once, even when two helpers run at the same time', async () => {
    await queueEmail();
    const { sent, transport } = recordingTransport();

    await Promise.all([deliverDueEmails(NOW, transport), deliverDueEmails(NOW, transport)]);

    expect(sent).toHaveLength(1);
  });

  it('erases a password link once a real email service has sent it', async () => {
    const email = await queueEmail({ kind: 'PASSWORD_RESET', data: { firstName: 'Dana', token: 'secret-token-123' } });
    const { sent, transport } = recordingTransport(false);

    await deliverDueEmails(NOW, transport);

    expect(sent[0].text).toContain('secret-token-123');
    expect(await reload(email.id)).toMatchObject({
      status: 'SENT',
      html: '(removed after sending)',
      textBody: '(removed after sending)',
      data: { firstName: 'Dana', token: null },
    });
  });

  it('keeps password links in the practice mailbox', async () => {
    const email = await queueEmail({ kind: 'PASSWORD_RESET', data: { firstName: 'Dana', token: 'secret-token-123' } });
    const { transport } = recordingTransport(true);

    await deliverDueEmails(NOW, transport);

    expect((await reload(email.id)).textBody).toContain('secret-token-123');
  });
});
