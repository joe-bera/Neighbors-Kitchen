import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../utils/errors.js';

/**
 * Parses input with a Zod schema, returning the parsed (trimmed, normalized) value.
 * Invalid input becomes a 422 listing the first problem for each field.
 */
export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input ?? {});
  if (!result.success) {
    const details: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const field = issue.path.join('.') || 'body';
      details[field] ??= issue.message;
    }
    throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields', details);
  }
  return result.data;
}

/** Validates `req.body` and replaces it with the parsed result. */
export function validateBody(schema: z.ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = parseInput(schema, req.body);
    next();
  };
}
