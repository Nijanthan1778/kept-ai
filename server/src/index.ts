import { createApp } from "./app.js";
import { config } from "./config.js";
import { openDatabase } from "./db/connection.js";
import { applySchema } from "./db/schema.js";
import { logger } from "./lib/logger.js";

const db = openDatabase(config.dbPath);
applySchema(db);
logger.info({ dbPath: config.dbPath }, "Database ready");

const server = createApp().listen(config.port, () => {
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
