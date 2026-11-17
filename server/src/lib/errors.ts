/**
 * Errors that are safe to show to API clients. Anything that is not an AppError
 * is treated as unexpected and turned into a generic 500 by the error middleware.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, "VALIDATION_ERROR", message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, "NOT_FOUND", message);
  }
}

/** A dependency we call (the AI provider, a fetched URL) failed. */
export class UpstreamError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super(502, "UPSTREAM_ERROR", message, undefined, options);
  }
}

/**
 * A background-processing failure whose message is safe to show the user
 * (stored as the item's error_message). The underlying cause is logged, never shown.
 */
export class IngestionError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "IngestionError";
  }
}

export interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}
