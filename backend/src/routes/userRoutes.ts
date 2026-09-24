import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { requireAuth } from '../middleware/auth.js';

export const userRoutes = Router();

userRoutes.get('/me', requireAuth, userController.getMe);
