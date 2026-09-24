import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../utils/errors.js';

/**
 * Validates `req.body` against a Zod schema and replaces it with the parsed
 * (trimmed, normalized) result. Invalid input becomes a 422 listing the first
 * problem for each field.
 */
export function validateBody(schema: z.ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const details: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path.join('.') || 'body';
        details[field] ??= issue.message;
      }
      throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields', details);
    }
    req.body = result.data;
    next();
  };
}
