import { Request, Response, Router } from 'express';
import { practiceMailboxEnabled } from '../services/notifications/mailer.js';
import { authRoutes } from './authRoutes.js';
import { chefRoutes, mealRoutes } from './catalogRoutes.js';
import { devRoutes } from './devRoutes.js';
import { reviewRoutes, suggestionRoutes } from './feedbackRoutes.js';
import { myKitchenRoutes, uploadRoutes } from './kitchenRoutes.js';
import { notificationRoutes } from './notificationRoutes.js';
import { orderRoutes } from './orderRoutes.js';
import { userRoutes } from './userRoutes.js';

export const apiRoutes = Router();

apiRoutes.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to Neighbors-Kitchen API v1',
    version: '1.0.0',
  });
});

apiRoutes.use('/auth', authRoutes);
apiRoutes.use('/users', userRoutes);
apiRoutes.use('/chefs/me', myKitchenRoutes); // before /chefs/:id, so "me" is not read as a chef id
apiRoutes.use('/chefs', chefRoutes);
apiRoutes.use('/meals', mealRoutes);
apiRoutes.use('/uploads', uploadRoutes);
apiRoutes.use('/orders', orderRoutes);
apiRoutes.use('/reviews', reviewRoutes);
apiRoutes.use('/suggestions', suggestionRoutes);
apiRoutes.use('/notifications', notificationRoutes);
// The practice mailbox shows everyone's emails, so it only exists outside production.
if (practiceMailboxEnabled()) apiRoutes.use('/dev', devRoutes);
