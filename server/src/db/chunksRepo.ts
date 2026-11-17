import { randomUUID } from "node:crypto";
import type { ChunkWithSource } from "../domain/chunk.js";
import type { SourceType } from "../domain/item.js";
import { blobToVector, vectorToBlob } from "../lib/vector.js";
import type { Db } from "./connection.js";

interface ChunkWithSourceRow {
  chunk_id: string;
  item_id: string;
  content: string;
  embedding: Buffer;
  title: string | null;
  source_type: SourceType;
  url: string | null;
}

export interface NewChunk {
  index: number;
  content: string;
  startOffset: number;
  endOffset: number;
  /** L2-normalised embedding of the chunk. */
  embedding: Float32Array;
}

export function createChunksRepo(db: Db) {
  const deleteForItemStmt = db.prepare(`DELETE FROM chunks WHERE item_id = ?`);
  const insertStmt = db.prepare(`
    INSERT INTO chunks (id, item_id, chunk_index, content, start_offset, end_offset, embedding)
    VALUES (@id, @itemId, @index, @content, @startOffset, @endOffset, @embedding)
  `);

  // Only `ready` items: a failed or half-processed item must never show up as a source.
  const readyWithSourceStmt = db.prepare<[], ChunkWithSourceRow>(`
    SELECT c.id AS chunk_id, c.item_id, c.content, c.embedding, i.title, i.source_type, i.url
    FROM chunks c
    JOIN items i ON i.id = c.item_id
    WHERE i.status = 'ready'
  `);

  const countReadyStmt = db
    .prepare<[], number>(`
      SELECT count(*) FROM chunks c JOIN items i ON i.id = c.item_id WHERE i.status = 'ready'
    `)
    .pluck();

  return {
    /**
     * Every searchable chunk with its embedding. Loading all vectors per query is O(n) in time
     * and memory: fine for thousands of chunks, and the first thing to replace at scale
     * (pgvector or a vector DB with an ANN index).
     */
    listReadyWithSource(): ChunkWithSource[] {
      return readyWithSourceStmt.all().map((row) => ({
        chunkId: row.chunk_id,
        itemId: row.item_id,
        content: row.content,
        embedding: blobToVector(row.embedding),
        title: row.title,
        sourceType: row.source_type,
        url: row.url,
      }));
    },

    /** Cheap check used to skip the embedding call entirely when nothing is searchable. */
    countReady(): number {
      return countReadyStmt.get()!;
    },

    /**
     * Replaces all chunks of an item. Deleting first makes re-processing (e.g. after a crash
     * mid-way) idempotent. Call inside a transaction so readers never see a half-written set.
     */
    replaceForItem(itemId: string, chunks: NewChunk[]): void {
      deleteForItemStmt.run(itemId);
      for (const chunk of chunks) {
        insertStmt.run({
          id: randomUUID(),
          itemId,
          index: chunk.index,
          content: chunk.content,
          startOffset: chunk.startOffset,
          endOffset: chunk.endOffset,
          embedding: vectorToBlob(chunk.embedding),
        });
      }
    },
  };
}

export type ChunksRepo = ReturnType<typeof createChunksRepo>;
