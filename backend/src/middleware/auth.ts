import { NextFunction, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { verifyAccessToken } from '../services/authService.js';
import { AppError } from '../utils/errors.js';

/** Requires a valid `Authorization: Bearer <access token>` header and sets `req.user`. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const [scheme, token] = req.get('Authorization')?.split(' ') ?? [];
  if (scheme !== 'Bearer' || !token) {
    throw new AppError(401, 'AUTH_REQUIRED', 'Please log in to continue');
  }
  const payload = verifyAccessToken(token);
  req.user = { id: payload.sub, role: payload.role };
  next();
}

/**
 * For pages anyone can see that show a little more to signed-in people.
 * No header means a visitor; a bad or expired token is still a 401, so the app can refresh it and retry.
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.get('Authorization')) {
    next();
    return;
  }
  requireAuth(req, res, next);
}

/** Allows the request only for the given roles. Use after requireAuth. */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to do that');
    }
    next();
  };
}
