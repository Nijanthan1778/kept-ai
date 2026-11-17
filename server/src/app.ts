import express from "express";
import { errorHandler, notFoundHandler } from "./lib/errorHandler.js";
import { requestLogger } from "./lib/requestLogger.js";
import { healthRouter } from "./routes/health.js";

// Notes are capped at 20k chars, so 100kb is generous while still bounding request size.
const JSON_BODY_LIMIT = "100kb";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");

  app.use(requestLogger);
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.use(healthRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
