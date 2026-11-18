import type { ChunksRepo } from "../db/chunksRepo.js";
import type { ChunkWithSource, ScoredChunk } from "../domain/chunk.js";
import type { Logger } from "../lib/logger.js";
import { cosineSimilarityOfNormalized } from "../lib/vector.js";

/**
 * Chunks one item may take before other items get a turn. Without this, a long page (many
 * similar chunks) can fill every slot and crowd out a short note that answers part of a
 * question. Measured with Gemini: "Who leads the workshop and what is RAG?" gave all 5 slots
 * to Wikipedia chunks (0.62–0.65) and dropped the note that answers the first half (0.56).
 */
export const MAX_CHUNKS_PER_ITEM = 3;

/**
 * Chunks must also score within this distance of the best match. The absolute threshold alone
 * lets weak, merely topical chunks (0.55–0.57) take slots when much better ones (0.71+) exist.
 * Measured with Gemini, every source an answer needed was within 0.09 of that question's best match.
 */
export const RELATIVE_SCORE_WINDOW = 0.1;

export interface RankOptions {
  topK: number;
  minSimilarity: number;
  maxChunksPerItem?: number;
  relativeScoreWindow?: number;
}

export interface RankResult {
  matches: ScoredChunk[];
  /** Chunks whose vector size differs from the question's (embedding model changed since ingest). */
  skippedDimensionMismatch: number;
}

/**
 * Picks the topK best chunks, but lets each item take at most `maxPerItem` until every other
 * qualifying item has had its chance. Leftover slots are then filled with the remaining best
 * chunks, so a question about a single long document still gets topK chunks from it.
 */
function selectDiverse(sortedBestFirst: ScoredChunk[], topK: number, maxPerItem: number): ScoredChunk[] {
  const selected: ScoredChunk[] = [];
  const deferred: ScoredChunk[] = [];
  const takenPerItem = new Map<string, number>();

  for (const chunk of sortedBestFirst) {
    if (selected.length === topK) break;
    const taken = takenPerItem.get(chunk.itemId) ?? 0;
    if (taken < maxPerItem) {
      selected.push(chunk);
      takenPerItem.set(chunk.itemId, taken + 1);
    } else {
      deferred.push(chunk);
    }
  }
  selected.push(...deferred.slice(0, topK - selected.length));
  return selected.sort((a, b) => b.score - a.score);
}

/**
 * Brute-force nearest-neighbour search: score every chunk, drop weak matches, keep the best.
 * O(n · d) per query and intentionally simple; exact results with no index to build or tune.
 */
export function rankChunks(
  questionVector: Float32Array,
  chunks: ChunkWithSource[],
  {
    topK,
    minSimilarity,
    maxChunksPerItem = MAX_CHUNKS_PER_ITEM,
    relativeScoreWindow = RELATIVE_SCORE_WINDOW,
  }: RankOptions,
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
  const bestScore = scored[0]?.score ?? 0;
  const closeToBest = scored.filter((chunk) => chunk.score >= bestScore - relativeScoreWindow);
  return { matches: selectDiverse(closeToBest, topK, maxChunksPerItem), skippedDimensionMismatch };
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
