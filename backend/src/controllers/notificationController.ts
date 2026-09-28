import { Request, Response } from 'express';
import { parseInput } from '../middleware/validateRequest.js';
import * as notificationService from '../services/notificationService.js';
import { notificationListQuerySchema } from '../validators/notificationSchemas.js';

export async function listNotifications(req: Request, res: Response) {
  const { limit } = parseInput(notificationListQuerySchema, req.query);
  const data = await notificationService.listNotifications(req.user!.id, limit);
  res.status(200).json({ success: true, data });
}

export async function getUnreadCount(req: Request, res: Response) {
  const unreadCount = await notificationService.countUnread(req.user!.id);
  res.status(200).json({ success: true, data: { unreadCount } });
}

export async function markAllRead(req: Request, res: Response) {
  await notificationService.markAllRead(req.user!.id);
  res.status(200).json({ success: true, data: { unreadCount: 0 } });
}
