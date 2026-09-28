import { Router } from 'express';
import * as notificationController from '../controllers/notificationController.js';
import { requireAuth } from '../middleware/auth.js';

// The signed-in person's bell: /api/v1/notifications/...
export const notificationRoutes = Router();
notificationRoutes.use(requireAuth);

notificationRoutes.get('/', notificationController.listNotifications);
notificationRoutes.get('/unread-count', notificationController.getUnreadCount);
notificationRoutes.post('/read-all', notificationController.markAllRead);
