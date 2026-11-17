import { pino } from "pino";
import { config } from "../config.js";

export const logger = pino({
  level: config.logLevel,
  // Defence in depth: never let credentials reach the logs, even if someone logs a config object or headers.
  redact: {
    paths: ["apiKey", "*.apiKey", "ai.apiKey", "req.headers.authorization", "req.headers.cookie"],
    censor: "[redacted]",
  },
});

export type Logger = typeof logger;
