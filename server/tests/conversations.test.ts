import { beforeEach, describe, expect, it } from "vitest";
import { createTransactionRunner, openDatabase, type Db } from "../src/db/connection.js";
import { createConversationsRepo } from "../src/db/conversationsRepo.js";
import { applySchema } from "../src/db/schema.js";
import type { QueryResult } from "../src/domain/answer.js";
import { createConversationService, type ConversationService } from "../src/services/conversations.js";

const result = (answer: string): QueryResult => ({
  answer,
  sources: [
    {
      index: 1,
      itemId: "item-1",
      chunkId: "chunk-1",
      title: "Offsite plan",
      sourceType: "note",
      url: null,
      snippet: "The offsite is in Goa.",
      score: 0.71,
      cited: true,
    },
  ],
});

let db: Db;
let conversations: ConversationService;

beforeEach(() => {
  // A real (in-memory) SQLite database, so foreign keys, cascades and transactions are exercised.
  db = openDatabase(":memory:");
  applySchema(db);
  conversations = createConversationService({
    conversationsRepo: createConversationsRepo(db),
    runInTransaction: createTransactionRunner(db),
  });
});

describe("conversation service", () => {
  it("starts a new conversation titled after the first question", () => {
    const { conversationId, turnId } = conversations.recordTurn(undefined, "  Where is the\n offsite?", result("In Goa [1]."));

    const conversation = conversations.get(conversationId)!;
    expect(conversation.title).toBe("Where is the");
    expect(conversation.turns).toHaveLength(1);
    expect(conversation.turns[0]).toMatchObject({ id: turnId, question: "  Where is the\n offsite?", answer: "In Goa [1]." });
  });

  it("stores the sources as a snapshot and returns them intact", () => {
    const { conversationId } = conversations.recordTurn(undefined, "Where?", result("In Goa [1]."));
    expect(conversations.get(conversationId)!.turns[0]!.sources).toEqual(result("x").sources);
  });

  it("appends follow-up turns in the order they were asked", () => {
    const { conversationId } = conversations.recordTurn(undefined, "First?", result("One."));
    conversations.recordTurn(conversationId, "Second?", result("Two."));
    conversations.recordTurn(conversationId, "Third?", result("Three."));

    expect(conversations.get(conversationId)!.turns.map((t) => t.question)).toEqual(["First?", "Second?", "Third?"]);
    expect(conversations.list()).toHaveLength(1);
    expect(conversations.list()[0]!.turnCount).toBe(3);
  });

  it("lists the most recently active conversation first", () => {
    const older = conversations.recordTurn(undefined, "Older", result("a")).conversationId;
    const newer = conversations.recordTurn(undefined, "Newer", result("b")).conversationId;
    expect(conversations.list().map((c) => c.id)).toEqual([newer, older]);

    // A new turn in the older conversation moves it back to the top.
    conversations.recordTurn(older, "Again", result("c"));
    expect(conversations.list()[0]!.id).toBe(older);
  });

  it("deletes a conversation together with its turns", () => {
    const { conversationId } = conversations.recordTurn(undefined, "Q", result("A"));
    conversations.recordTurn(conversationId, "Q2", result("A2"));

    expect(conversations.delete(conversationId)).toBe(true);
    expect(conversations.get(conversationId)).toBeUndefined();
    expect(db.prepare("SELECT count(*) AS n FROM conversation_turns").get()).toEqual({ n: 0 });
    expect(conversations.delete(conversationId)).toBe(false);
  });

  it("reports whether a conversation exists", () => {
    const { conversationId } = conversations.recordTurn(undefined, "Q", result("A"));
    expect(conversations.exists(conversationId)).toBe(true);
    expect(conversations.exists("00000000-0000-4000-8000-000000000000")).toBe(false);
  });
});
