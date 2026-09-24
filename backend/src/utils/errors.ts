/**
 * An error that is safe to show to the client. The error handler turns it into
 * `{ success: false, error: { code, message, details } }` with the given status.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: Record<string, string>;

  constructor(statusCode: number, code: string, message: string, details?: Record<string, string>) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}
