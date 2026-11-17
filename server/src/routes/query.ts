import { Router } from "express";
import { parseOrThrow } from "../lib/validate.js";
import { queryRequestSchema } from "../schemas/query.js";
import type { QueryService } from "../services/query.js";

export function createQueryRouter(queries: QueryService) {
  const router = Router();

  router.post("/query", async (req, res) => {
    const { question } = parseOrThrow(queryRequestSchema, req.body);
    // req.log carries the request ID, so stage timings in the logs match this request.
    const result = await queries.answerQuestion(question, req.log);
    res.json(result);
  });

  return router;
}
