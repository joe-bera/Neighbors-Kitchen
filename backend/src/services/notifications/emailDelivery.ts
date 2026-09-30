import { Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { isReservedAddress } from './addresses.js';
import { RenderedEmail, renderEmail } from './emailTemplates.js';
import { EmailTransport } from './mailer.js';

// Works through the emails table: writes each due email, sends it, and retries on failure.
// Email addresses and contents are never written to the logs.

const BATCH_SIZE = 20;
const MAX_ATTEMPTS = 5;
const MINUTE_MS = 60 * 1000;
// Minutes to wait after the 1st, 2nd, 3rd and 4th failed try.
const RETRY_DELAYS_MINUTES = [1, 5, 30, 120];
// An email in SENDING for longer than this was being sent when the server stopped.
const STUCK_AFTER_MS = 10 * MINUTE_MS;
const REMOVED = '(removed after sending)';
const SKIPPED_NOTE = 'Not sent: example address';

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Line breaks and other control characters never go into a subject line. */
export function cleanSubject(subject: string): string {
  return subject.replace(/\p{Cc}+/gu, ' ').replace(/ {2,}/g, ' ').trim();
}

/** A password email's data without its working link. */
const withoutToken = (data: Prisma.JsonValue) => ({ ...(data as Prisma.JsonObject), token: null }) as Prisma.InputJsonObject;

export async function deliverDueEmails(now: Date, transport: EmailTransport): Promise<{ sent: number; failed: number }> {
  await prisma.email.updateMany({
    where: { status: 'SENDING', updatedAt: { lt: new Date(now.getTime() - STUCK_AFTER_MS) } },
    data: { status: 'PENDING' },
  });

  const due = await prisma.email.findMany({
    where: { status: 'PENDING', sendAfter: { lte: now } },
    orderBy: { createdAt: 'asc' },
    take: BATCH_SIZE,
    select: { id: true },
  });

  let sent = 0;
  let failed = 0;
  for (const { id } of due) {
    // Claim it: only one helper can move it from PENDING to SENDING. updatedAt records when, for the stuck check above.
    const { count } = await prisma.email.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'SENDING', attempts: { increment: 1 }, updatedAt: now },
    });
    if (count === 0) continue;
    const email = await prisma.email.findUniqueOrThrow({ where: { id } });

    // The sample accounts' made-up addresses never go to a real email service.
    if (!transport.keepsCopies && isReservedAddress(email.toAddress)) {
      await prisma.email.update({
        where: { id },
        data: { status: 'SKIPPED', lastError: SKIPPED_NOTE, ...(email.kind === 'PASSWORD_RESET' && { data: withoutToken(email.data) }) },
      });
      continue;
    }

    let written: RenderedEmail;
    try {
      written = renderEmail(email.kind, email.data);
    } catch (error) {
      // A template problem will not fix itself by waiting.
      await prisma.email.update({ where: { id }, data: { status: 'FAILED', lastError: `Could not write this email: ${messageOf(error)}` } });
      failed += 1;
      continue;
    }
    const subject = cleanSubject(written.subject);
    const copy = { subject, html: written.html, textBody: written.text };

    try {
      await transport.send({ id, to: email.toAddress, from: env.EMAIL_FROM, subject, html: written.html, text: written.text });
    } catch (error) {
      const retry = email.attempts < MAX_ATTEMPTS;
      console.warn(`Email ${id} (${email.kind}) was not sent: ${messageOf(error)}${retry ? ' (will try again)' : ' (gave up)'}`);
      await prisma.email.update({
        where: { id },
        data: {
          ...copy,
          status: retry ? 'PENDING' : 'FAILED',
          lastError: messageOf(error),
          ...(retry && { sendAfter: new Date(now.getTime() + RETRY_DELAYS_MINUTES[email.attempts - 1] * MINUTE_MS) }),
        },
      });
      if (!retry) failed += 1;
      continue;
    }

    // Once a real service has a password link, the database does not keep a working copy.
    const erase = !transport.keepsCopies && email.kind === 'PASSWORD_RESET';
    await prisma.email.update({
      where: { id },
      data: {
        ...copy,
        status: 'SENT',
        sentAt: now,
        lastError: null,
        ...(erase && {
          html: REMOVED,
          textBody: REMOVED,
          data: withoutToken(email.data),
        }),
      },
    });
    sent += 1;
  }
  return { sent, failed };
}
