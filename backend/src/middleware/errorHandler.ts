import { NextFunction, Request, Response } from 'express';
import { isProduction } from '../config/env.js';
import { AppError } from '../utils/errors.js';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found',
    },
  });
}

/** Errors raised by Express itself, such as malformed JSON, carry a 4xx `status`. */
function isClientHttpError(err: unknown): err is { status: number } {
  const status = (err as { status?: unknown })?.status;
  return typeof status === 'number' && status >= 400 && status < 500;
}

// Express needs all four parameters to treat this as an error handler
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
      },
    });
    return;
  }

  if (isClientHttpError(err)) {
    res.status(err.status).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'The request could not be understood',
      },
    });
    return;
  }

  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isProduction || !(err instanceof Error)
        ? 'An unexpected error occurred'
        : err.message,
    },
  });
}
