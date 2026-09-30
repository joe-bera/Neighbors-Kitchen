import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validateRequest.js';
import { emailSettingsSchema } from '../validators/userSchemas.js';

export const userRoutes = Router();

userRoutes.get('/me', requireAuth, userController.getMe);
userRoutes.put('/me/email-settings', requireAuth, validateBody(emailSettingsSchema), userController.updateEmailSettings);
