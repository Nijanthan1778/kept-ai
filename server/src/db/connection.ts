import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type Db = Database.Database;

/** Runs `fn` atomically: every write inside commits together or not at all. */
export type RunInTransaction = <T>(fn: () => T) => T;

export function createTransactionRunner(db: Db): RunInTransaction {
  return (fn) => db.transaction(fn)();
}

export function openDatabase(dbPath: string): Db {
  if (dbPath !== ":memory:") {
    mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  // WAL lets reads (GET /items, /query) proceed while the background pipeline writes.
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}
