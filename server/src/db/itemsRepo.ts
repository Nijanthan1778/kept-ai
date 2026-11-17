import { randomUUID } from "node:crypto";
import type { Item, ItemStatus, ItemWithContent, ItemWithContentHead, SourceType } from "../domain/item.js";
import type { Db } from "./connection.js";

interface ItemRow {
  id: string;
  source_type: SourceType;
  url: string | null;
  title: string | null;
  status: ItemStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface ItemRowWithContentHead extends ItemRow {
  content_head: string | null;
}

interface ItemRowWithContent extends ItemRow {
  raw_content: string | null;
}

export interface NewItem {
  sourceType: SourceType;
  url: string | null;
  title: string | null;
  rawContent: string | null;
}

function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    sourceType: row.source_type,
    url: row.url,
    title: row.title,
    status: row.status,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createItemsRepo(db: Db) {
  const insertStmt = db.prepare(`
    INSERT INTO items (id, source_type, url, title, raw_content, status, error_message, created_at, updated_at)
    VALUES (@id, @sourceType, @url, @title, @rawContent, 'pending', NULL, @now, @now)
  `);

  // substr() keeps list queries cheap: a fetched web page can be megabytes of text.
  const listStmt = db.prepare<[number], ItemRowWithContentHead>(`
    SELECT id, source_type, url, title, status, error_message, created_at, updated_at,
           substr(raw_content, 1, ?) AS content_head
    FROM items
    ORDER BY created_at DESC, rowid DESC
  `);

  const findWithContentStmt = db.prepare<[string], ItemRowWithContent>(`SELECT * FROM items WHERE id = ?`);

  const idsByStatusStmt = db
    .prepare<[ItemStatus], string>(`SELECT id FROM items WHERE status = ? ORDER BY created_at`)
    .pluck();

  // COALESCE keeps an existing title when the page had none (e.g. plain-text files).
  const saveContentStmt = db.prepare(`
    UPDATE items SET title = COALESCE(@title, title), raw_content = @rawContent, updated_at = @now
    WHERE id = @id
  `);

  const markReadyStmt = db.prepare(`
    UPDATE items SET status = 'ready', error_message = NULL, updated_at = @now WHERE id = @id
  `);

  const markFailedStmt = db.prepare(`
    UPDATE items SET status = 'failed', error_message = @errorMessage, updated_at = @now
    WHERE id = @id
  `);

  return {
    /** Inserts a new item in the `pending` state. */
    insert(newItem: NewItem): ItemWithContent {
      const id = randomUUID();
      const now = new Date().toISOString();
      insertStmt.run({ id, now, ...newItem });
      return {
        id,
        ...newItem,
        status: "pending",
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
      };
    },

    /** All items, newest first, each with at most `headLength` characters of content. */
    listWithContentHead(headLength: number): ItemWithContentHead[] {
      return listStmt.all(headLength).map((row) => ({
        ...toItem(row),
        contentHead: row.content_head,
      }));
    },

    findWithContent(id: string): ItemWithContent | undefined {
      const row = findWithContentStmt.get(id);
      return row && { ...toItem(row), rawContent: row.raw_content };
    },

    /** Oldest first, so recovered items are processed in the order they were saved. */
    listIdsByStatus(status: ItemStatus): string[] {
      return idsByStatusStmt.all(status);
    },

    saveExtractedContent(id: string, content: { title: string | null; rawContent: string }): void {
      saveContentStmt.run({ id, ...content, now: new Date().toISOString() });
    },

    markReady(id: string): void {
      markReadyStmt.run({ id, now: new Date().toISOString() });
    },

    markFailed(id: string, errorMessage: string): void {
      markFailedStmt.run({ id, errorMessage, now: new Date().toISOString() });
    },
  };
}

export type ItemsRepo = ReturnType<typeof createItemsRepo>;
