import { Notification } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

// The signed-in person's bell: their own notices only.

function toNotificationView(notification: Notification) {
  return {
    id: notification.id,
    kind: notification.kind,
    title: notification.title,
    body: notification.body,
    link: notification.link,
    createdAt: notification.createdAt,
    read: notification.readAt !== null,
  };
}

export function countUnread(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function listNotifications(userId: string, limit: number) {
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit }),
    countUnread(userId),
  ]);
  return { notifications: notifications.map(toNotificationView), unreadCount };
}

export async function markAllRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}
