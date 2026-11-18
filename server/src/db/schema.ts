import type { Db } from "./connection.js";

/**
 * Idempotent schema setup. A migration tool would be overkill for two tables;
 * in production this would become versioned migrations.
 */
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS items (
  id               TEXT PRIMARY KEY,
  source_type      TEXT NOT NULL CHECK (source_type IN ('note', 'url')),
  url              TEXT,
  title            TEXT,
  raw_content      TEXT,
  status           TEXT NOT NULL CHECK (status IN ('pending', 'ready', 'failed')),
  processing_stage TEXT CHECK (processing_stage IN ('fetching', 'chunking', 'embedding', 'saving')),
  error_message    TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
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

-- Chat history. Only answered questions are stored; failed requests stay client-side for retry.
CREATE TABLE IF NOT EXISTS conversations (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversation_turns (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  question        TEXT NOT NULL,
  answer          TEXT NOT NULL,
  sources_json    TEXT NOT NULL, -- QuerySource[] snapshot; not a foreign key, so removing an item keeps old answers intact
  created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conversation_turns_conversation_id ON conversation_turns (conversation_id, created_at);
`;

/** Brings a database created by an older version up to date without losing its data. */
function addColumnIfMissing(db: Db, table: string, column: string, definition: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function applySchema(db: Db): void {
  db.exec(SCHEMA_SQL);
  addColumnIfMissing(
    db,
    "items",
    "processing_stage",
    "TEXT CHECK (processing_stage IN ('fetching', 'chunking', 'embedding', 'saving'))",
  );
}
