import type { QuerySource } from "../domain/answer.js";
import type { Conversation, ConversationSummary, ConversationTurn } from "../domain/conversation.js";
import type { Db } from "./connection.js";

interface ConversationRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ConversationSummaryRow extends ConversationRow {
  turn_count: number;
}

interface TurnRow {
  id: string;
  question: string;
  answer: string;
  sources_json: string;
  created_at: string;
}

export interface NewTurn {
  id: string;
  conversationId: string;
  question: string;
  answer: string;
  sources: QuerySource[];
  createdAt: string;
}

export function createConversationsRepo(db: Db) {
  const insertConversationStmt = db.prepare(`
    INSERT INTO conversations (id, title, created_at, updated_at) VALUES (@id, @title, @now, @now)
  `);
  const touchStmt = db.prepare(`UPDATE conversations SET updated_at = @now WHERE id = @id`);
  const insertTurnStmt = db.prepare(`
    INSERT INTO conversation_turns (id, conversation_id, question, answer, sources_json, created_at)
    VALUES (@id, @conversationId, @question, @answer, @sourcesJson, @createdAt)
  `);
  const existsStmt = db.prepare<[string], number>(`SELECT 1 FROM conversations WHERE id = ?`).pluck();
  const findStmt = db.prepare<[string], ConversationRow>(`SELECT * FROM conversations WHERE id = ?`);
  const turnsStmt = db.prepare<[string], TurnRow>(`
    SELECT id, question, answer, sources_json, created_at FROM conversation_turns
    WHERE conversation_id = ? ORDER BY created_at, rowid
  `);
  // Most recent activity first, by the newest turn's rowid: rowids only grow, so this is exact
  // even when two turns share a millisecond timestamp (updated_at would tie).
  const listStmt = db.prepare<[], ConversationSummaryRow>(`
    SELECT c.id, c.title, c.created_at, c.updated_at, count(t.id) AS turn_count
    FROM conversations c
    LEFT JOIN conversation_turns t ON t.conversation_id = c.id
    GROUP BY c.id
    ORDER BY max(t.rowid) DESC
  `);
  // Turns go too, via ON DELETE CASCADE.
  const deleteStmt = db.prepare(`DELETE FROM conversations WHERE id = ?`);

  return {
    create(id: string, title: string, now: string): void {
      insertConversationStmt.run({ id, title, now });
    },

    /** Marks a conversation as recently active, so it moves to the top of the history. */
    touch(id: string, now: string): void {
      touchStmt.run({ id, now });
    },

    insertTurn(turn: NewTurn): void {
      insertTurnStmt.run({ ...turn, sourcesJson: JSON.stringify(turn.sources) });
    },

    exists(id: string): boolean {
      return existsStmt.get(id) !== undefined;
    },

    /** Newest activity first. */
    listSummaries(): ConversationSummary[] {
      return listStmt.all().map((row) => ({
        id: row.id,
        title: row.title,
        turnCount: row.turn_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    },

    /** The conversation's own fields, without its turns. */
    find(id: string): Omit<Conversation, "turns"> | undefined {
      const row = findStmt.get(id);
      return row && { id: row.id, title: row.title, createdAt: row.created_at, updatedAt: row.updated_at };
    },

    /** Oldest first, i.e. in the order they were asked. */
    listTurns(conversationId: string): ConversationTurn[] {
      return turnsStmt.all(conversationId).map((row) => ({
        id: row.id,
        question: row.question,
        answer: row.answer,
        sources: JSON.parse(row.sources_json) as QuerySource[],
        createdAt: row.created_at,
      }));
    },

    /** Returns false if there was no such conversation. */
    delete(id: string): boolean {
      return deleteStmt.run(id).changes > 0;
    },
  };
}

export type ConversationsRepo = ReturnType<typeof createConversationsRepo>;
