import { Request, Response, Router } from 'express';
import { authRoutes } from './authRoutes.js';
import { chefRoutes, mealRoutes } from './catalogRoutes.js';
import { myKitchenRoutes, uploadRoutes } from './kitchenRoutes.js';
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
