import { Router } from "express";
import { parseOrThrow } from "../lib/validate.js";
import { ingestRequestSchema } from "../schemas/ingest.js";
import type { IngestionService } from "../services/ingestion.js";
import { toItemDto } from "./itemDto.js";

export function createIngestRouter(ingestion: IngestionService) {
  const router = Router();

  // 202 Accepted: the item is saved, but becomes searchable only once background processing finishes.
  router.post("/ingest", (req, res) => {
    const request = parseOrThrow(ingestRequestSchema, req.body);
    const item = ingestion.ingest(request);
    res.status(202).json({ item: toItemDto(item, item.rawContent) });
  });

  return router;
}
