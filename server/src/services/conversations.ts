import { randomUUID } from "node:crypto";
import type { RunInTransaction } from "../db/connection.js";
import type { ConversationsRepo } from "../db/conversationsRepo.js";
import type { QueryResult } from "../domain/answer.js";
import type { Conversation, ConversationSummary } from "../domain/conversation.js";
import { firstLineTitle } from "../lib/text.js";

const TITLE_MAX_CHARS = 80;

interface ConversationDeps {
  conversationsRepo: ConversationsRepo;
  runInTransaction: RunInTransaction;
}

export interface RecordedTurn {
  conversationId: string;
  turnId: string;
}

/** Chat history: each answered question is stored as a turn of a conversation. */
export function createConversationService({ conversationsRepo, runInTransaction }: ConversationDeps) {
  return {
    exists(id: string): boolean {
      return conversationsRepo.exists(id);
    },

    /**
     * Saves an answered question. Without a conversationId it starts a new conversation titled
     * after the question. One transaction, so a conversation never exists without its first turn.
     */
    recordTurn(conversationId: string | undefined, question: string, result: QueryResult): RecordedTurn {
      const now = new Date().toISOString();
      const turnId = randomUUID();
      return runInTransaction(() => {
        const id = conversationId ?? randomUUID();
        if (conversationId) {
          conversationsRepo.touch(id, now);
        } else {
          conversationsRepo.create(id, firstLineTitle(question, TITLE_MAX_CHARS), now);
        }
        conversationsRepo.insertTurn({
          id: turnId,
          conversationId: id,
          question,
          answer: result.answer,
          sources: result.sources,
          createdAt: now,
        });
        return { conversationId: id, turnId };
      });
    },

    list(): ConversationSummary[] {
      return conversationsRepo.listSummaries();
    },

    get(id: string): Conversation | undefined {
      const conversation = conversationsRepo.find(id);
      return conversation && { ...conversation, turns: conversationsRepo.listTurns(id) };
    },

    delete(id: string): boolean {
      return conversationsRepo.delete(id);
    },
  };
}

export type ConversationService = ReturnType<typeof createConversationService>;
