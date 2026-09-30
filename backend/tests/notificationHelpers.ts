import { prisma } from '../src/lib/prisma.js';

// Test-only helpers for reading notices. Rows come back in the order the kinds are listed in the
// NotificationKind enum (then oldest first), so assertions never depend on timing.

export function bellFor(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }],
    select: { kind: true, title: true, body: true, link: true },
  });
}

export function emailsFor(userId: string) {
  return prisma.email.findMany({
    where: { userId },
    orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }],
    select: { kind: true, toAddress: true, data: true, status: true },
  });
}
