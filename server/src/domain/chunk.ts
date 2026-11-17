import type { SourceType } from "./item.js";

/** A stored chunk joined with the item it came from: everything needed to rank and cite it. */
export interface ChunkWithSource {
  chunkId: string;
  itemId: string;
  content: string;
  embedding: Float32Array;
  title: string | null;
  sourceType: SourceType;
  url: string | null;
}

export interface ScoredChunk extends ChunkWithSource {
  /** Cosine similarity to the question, from -1 to 1 (higher is more relevant). */
  score: number;
}
