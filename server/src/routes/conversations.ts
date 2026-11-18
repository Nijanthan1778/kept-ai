import { Router } from "express";
import { NotFoundError } from "../lib/errors.js";
import { parseOrThrow } from "../lib/validate.js";
import { conversationIdParamsSchema } from "../schemas/conversations.js";
import type { ConversationService } from "../services/conversations.js";

export function createConversationsRouter(conversations: ConversationService) {
  const router = Router();

  router.get("/conversations", (_req, res) => {
    res.json({ conversations: conversations.list() });
  });

  router.get("/conversations/:id", (req, res) => {
    const { id } = parseOrThrow(conversationIdParamsSchema, req.params);
    const conversation = conversations.get(id);
    if (!conversation) {
      throw new NotFoundError(`Conversation ${id} does not exist`);
    }
    res.json({ conversation });
  });

  router.delete("/conversations/:id", (req, res) => {
    const { id } = parseOrThrow(conversationIdParamsSchema, req.params);
    if (!conversations.delete(id)) {
      throw new NotFoundError(`Conversation ${id} does not exist`);
    }
    res.status(204).end();
  });

  return router;
}
