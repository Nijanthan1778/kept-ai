import { Router } from "express";
import { NotFoundError } from "../lib/errors.js";
import { parseOrThrow } from "../lib/validate.js";
import { queryRequestSchema } from "../schemas/query.js";
import type { ConversationService } from "../services/conversations.js";
import type { QueryService } from "../services/query.js";

export function createQueryRouter(queries: QueryService, conversations: ConversationService) {
  const router = Router();

  router.post("/query", async (req, res) => {
    const { question, conversationId } = parseOrThrow(queryRequestSchema, req.body);
    // Check before calling the AI, so a bad ID doesn't cost an embedding and an LLM call.
    if (conversationId && !conversations.exists(conversationId)) {
      throw new NotFoundError(`Conversation ${conversationId} does not exist`);
    }

    // req.log carries the request ID, so stage timings in the logs match this request.
    const result = await queries.answerQuestion(question, req.log);
    const saved = conversations.recordTurn(conversationId, question, result);
    res.json({ ...result, ...saved });
  });

  return router;
}
