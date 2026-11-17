import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError, NotFoundError, type ErrorBody } from "./errors.js";

/** Catch-all for routes that don't exist. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.path} does not exist`));
};

/** Errors raised by express.json() before our code runs, mapped to client errors. */
function fromBodyParser(err: unknown): AppError | undefined {
  const type = (err as { type?: string } | null)?.type;
  if (type === "entity.parse.failed") {
    return new AppError(400, "INVALID_JSON", "Request body is not valid JSON");
  }
  if (type === "entity.too.large") {
    return new AppError(413, "PAYLOAD_TOO_LARGE", "Request body is too large");
  }
  return undefined;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const appError = err instanceof AppError ? err : fromBodyParser(err);

  if (appError) {
    if (appError.status >= 500) {
      // Upstream failures: keep the full error (and its cause) for debugging.
      req.log.error({ err, code: appError.code }, appError.message);
    } else {
      // Client errors are expected: no stack trace, and never the raw body (it may hold user content).
      req.log.warn({ code: appError.code, details: appError.details }, appError.message);
    }
    const body: ErrorBody = {
      error: { code: appError.code, message: appError.message, details: appError.details },
    };
    res.status(appError.status).json(body);
    return;
  }

  // Unknown error: full details stay in the server log, the client gets a generic message.
  req.log.error({ err }, "Unhandled error");
  const body: ErrorBody = {
    error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
  };
  res.status(500).json(body);
};
