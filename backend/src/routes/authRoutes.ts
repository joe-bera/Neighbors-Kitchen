import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import * as authController from '../controllers/authController.js';
import { validateBody } from '../middleware/validateRequest.js';
import { loginSchema, registerSchema } from '../validators/authSchemas.js';

// A tighter limit for sign-up and login attempts from one IP address.
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  skip: () => env.NODE_ENV === 'test',
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a few minutes and try again.' },
  },
});

export const authRoutes = Router();

authRoutes.post('/register', credentialLimiter, validateBody(registerSchema), authController.register);
authRoutes.post('/login', credentialLimiter, validateBody(loginSchema), authController.login);
authRoutes.post('/refresh-token', authController.refreshToken);
authRoutes.post('/logout', authController.logout);
