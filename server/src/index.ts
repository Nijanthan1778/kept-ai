import { createAiClient } from "./ai/client.js";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { createChunksRepo } from "./db/chunksRepo.js";
import { createTransactionRunner, openDatabase } from "./db/connection.js";
import { createItemsRepo } from "./db/itemsRepo.js";
import { applySchema } from "./db/schema.js";
import { logger } from "./lib/logger.js";
import { createAnswerService } from "./services/answer.js";
import { createEmbeddingService } from "./services/embeddings.js";
import { fetchAndExtract } from "./services/extractor.js";
import { createIngestionService } from "./services/ingestion.js";
import { createQueryService } from "./services/query.js";
import { createRetrievalService } from "./services/retrieval.js";

const db = openDatabase(config.dbPath);
applySchema(db);
logger.info({ dbPath: config.dbPath }, "Database ready");

// Composition root: build each dependency once and pass it down.
const itemsRepo = createItemsRepo(db);
const chunksRepo = createChunksRepo(db);
const aiClient = createAiClient({ apiKey: config.ai.apiKey, baseUrl: config.ai.baseUrl });
const embeddings = createEmbeddingService({ client: aiClient, model: config.ai.embeddingModel, logger });
const ingestion = createIngestionService({
  itemsRepo,
  chunksRepo,
  runInTransaction: createTransactionRunner(db),
  embeddings,
  fetchAndExtract,
  logger,
});
const queries = createQueryService({
  embeddings,
  retrieval: createRetrievalService({ chunksRepo, options: config.retrieval }),
  answers: createAnswerService({ client: aiClient, model: config.ai.chatModel }),
});

const resumedCount = ingestion.resumePendingItems();
if (resumedCount > 0) {
  logger.info({ count: resumedCount }, "Re-queued items left pending by a previous run");
}

const server = createApp({ ingestion, itemsRepo, queries }).listen(config.port, () => {
  logger.info({ port: config.port }, "Server listening");
});

function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
