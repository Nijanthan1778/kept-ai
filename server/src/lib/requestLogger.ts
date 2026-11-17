import { randomUUID } from "node:crypto";
import { pinoHttp } from "pino-http";
import { logger } from "./logger.js";

const REQUEST_ID_HEADER = "x-request-id";

/**
 * Structured access log + per-request child logger (req.log).
 * Reuses an incoming X-Request-Id (e.g. from a proxy) or generates one, and echoes it back
 * so a client-reported error can be matched to server logs.
 */
export const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const incoming = req.headers[REQUEST_ID_HEADER];
    const id = typeof incoming === "string" && incoming.length > 0 ? incoming : randomUUID();
    res.setHeader("X-Request-Id", id);
    return id;
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  // Keep access logs compact: no full header dumps.
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});
