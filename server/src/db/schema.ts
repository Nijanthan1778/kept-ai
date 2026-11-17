import type { Db } from "./connection.js";

/**
 * Idempotent schema setup. A migration tool would be overkill for two tables;
 * in production this would become versioned migrations.
 */
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS items (
  id            TEXT PRIMARY KEY,
  source_type   TEXT NOT NULL CHECK (source_type IN ('note', 'url')),
  url           TEXT,
  title         TEXT,
  raw_content   TEXT,
  status        TEXT NOT NULL CHECK (status IN ('pending', 'ready', 'failed')),
  error_message TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_items_created_at ON items (created_at);
CREATE INDEX IF NOT EXISTS idx_items_status ON items (status);

CREATE TABLE IF NOT EXISTS chunks (
  id           TEXT PRIMARY KEY,
  item_id      TEXT NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  chunk_index  INTEGER NOT NULL,
  content      TEXT NOT NULL,
  start_offset INTEGER NOT NULL,
  end_offset   INTEGER NOT NULL,
  embedding    BLOB NOT NULL, -- Float32Array bytes, L2-normalized
  UNIQUE (item_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_chunks_item_id ON chunks (item_id);
`;

export function applySchema(db: Db): void {
  db.exec(SCHEMA_SQL);
}
