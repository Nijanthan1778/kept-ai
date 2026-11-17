import type { ChunksRepo } from "../db/chunksRepo.js";
import type { ChunkWithSource, ScoredChunk } from "../domain/chunk.js";
import type { Logger } from "../lib/logger.js";
import { cosineSimilarityOfNormalized } from "../lib/vector.js";

export interface RankOptions {
  topK: number;
  minSimilarity: number;
}

export interface RankResult {
  matches: ScoredChunk[];
  /** Chunks whose vector size differs from the question's (embedding model changed since ingest). */
  skippedDimensionMismatch: number;
}

/**
 * Brute-force nearest-neighbour search: score every chunk, drop weak matches, keep the best.
 * O(n · d) per query and intentionally simple; exact results with no index to build or tune.
 */
export function rankChunks(
  questionVector: Float32Array,
  chunks: ChunkWithSource[],
  { topK, minSimilarity }: RankOptions,
): RankResult {
  let skippedDimensionMismatch = 0;
  const scored: ScoredChunk[] = [];

  for (const chunk of chunks) {
    if (chunk.embedding.length !== questionVector.length) {
      skippedDimensionMismatch++;
      continue;
    }
    const score = cosineSimilarityOfNormalized(questionVector, chunk.embedding);
    if (score >= minSimilarity) scored.push({ ...chunk, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return { matches: scored.slice(0, topK), skippedDimensionMismatch };
}

interface RetrievalDeps {
  chunksRepo: ChunksRepo;
  options: RankOptions;
}

export function createRetrievalService({ chunksRepo, options }: RetrievalDeps) {
  return {
    hasSearchableContent(): boolean {
      return chunksRepo.countReady() > 0;
    },

    findRelevantChunks(questionVector: Float32Array, log: Logger): ScoredChunk[] {
      const candidates = chunksRepo.listReadyWithSource();
      const { matches, skippedDimensionMismatch } = rankChunks(questionVector, candidates, options);
      if (skippedDimensionMismatch > 0) {
        log.warn(
          { skippedDimensionMismatch, expectedDimensions: questionVector.length },
          "Some chunks were embedded with a different model; re-ingest them to make them searchable",
        );
      }
      log.debug({ candidateCount: candidates.length, matchCount: matches.length }, "Ranked chunks");
      return matches;
    },
  };
}

export type RetrievalService = ReturnType<typeof createRetrievalService>;
