import type { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      /** Set by the requireAuth middleware for signed-in requests. */
      user?: {
        id: string;
        role: UserRole;
      };
    }
  }
}

export {};
