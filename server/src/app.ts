import express from "express";
import type { ItemsRepo } from "./db/itemsRepo.js";
import { errorHandler, notFoundHandler } from "./lib/errorHandler.js";
import { requestLogger } from "./lib/requestLogger.js";
import { createConversationsRouter } from "./routes/conversations.js";
import { healthRouter } from "./routes/health.js";
import { createIngestRouter } from "./routes/ingest.js";
import { createItemsRouter } from "./routes/items.js";
import { createQueryRouter } from "./routes/query.js";
import type { ConversationService } from "./services/conversations.js";
import type { IngestionService } from "./services/ingestion.js";
import type { QueryService } from "./services/query.js";

// Notes are capped at 20k chars, so 100kb is generous while still bounding request size.
const JSON_BODY_LIMIT = "100kb";

/** Everything the HTTP layer needs, passed in so tests can supply their own. */
export interface AppDeps {
  ingestion: IngestionService;
  itemsRepo: ItemsRepo;
  queries: QueryService;
  conversations: ConversationService;
}

export function createApp({ ingestion, itemsRepo, queries, conversations }: AppDeps) {
  const app = express();
  app.disable("x-powered-by");

  app.use(requestLogger);
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.use(healthRouter);
  app.use(createIngestRouter(ingestion));
  app.use(createItemsRouter(itemsRepo));
  app.use(createQueryRouter(queries, conversations));
  app.use(createConversationsRouter(conversations));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
