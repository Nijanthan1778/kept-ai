import express from "express";
import { errorHandler, notFoundHandler } from "./lib/errorHandler.js";
import { requestLogger } from "./lib/requestLogger.js";
import { healthRouter } from "./routes/health.js";
import { createIngestRouter } from "./routes/ingest.js";
import type { IngestionService } from "./services/ingestion.js";

// Notes are capped at 20k chars, so 100kb is generous while still bounding request size.
const JSON_BODY_LIMIT = "100kb";

/** Everything the HTTP layer needs, passed in so tests can supply their own. */
export interface AppDeps {
  ingestion: IngestionService;
}

export function createApp({ ingestion }: AppDeps) {
  const app = express();
  app.disable("x-powered-by");

  app.use(requestLogger);
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.use(healthRouter);
  app.use(createIngestRouter(ingestion));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
