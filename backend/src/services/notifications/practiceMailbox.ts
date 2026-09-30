import { Email } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/errors.js';

// The practice mailbox (development only): every email the app has queued, as it was written.

function toListItem(email: Email) {
  return {
    id: email.id,
    to: email.toAddress,
    kind: email.kind,
    subject: email.subject,
    status: email.status,
    attempts: email.attempts,
    lastError: email.lastError,
    createdAt: email.createdAt,
    sentAt: email.sentAt,
  };
}

export async function listPracticeEmails() {
  const emails = await prisma.email.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100 });
  return emails.map(toListItem);
}

export async function getPracticeEmail(id: string) {
  const email = await prisma.email.findUnique({ where: { id } });
  if (!email) throw new AppError(404, 'NOT_FOUND', 'We could not find that email');
  return { ...toListItem(email), html: email.html, text: email.textBody };
}
