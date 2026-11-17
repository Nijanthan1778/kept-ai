import { createApp } from "./app.js";
import { config } from "./config.js";
import { openDatabase } from "./db/connection.js";
import { createItemsRepo } from "./db/itemsRepo.js";
import { applySchema } from "./db/schema.js";
import { logger } from "./lib/logger.js";
import { createIngestionService } from "./services/ingestion.js";

const db = openDatabase(config.dbPath);
applySchema(db);
logger.info({ dbPath: config.dbPath }, "Database ready");

// Composition root: build each dependency once and pass it down.
const itemsRepo = createItemsRepo(db);
const ingestion = createIngestionService({ itemsRepo, logger });

const server = createApp({ ingestion, itemsRepo }).listen(config.port, () => {
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
