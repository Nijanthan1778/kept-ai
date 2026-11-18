import { describe, expect, it } from "vitest";
import type { ChunkWithSource } from "../src/domain/chunk.js";
import { normalize } from "../src/lib/vector.js";
import { rankChunks } from "../src/services/retrieval.js";

function chunk(id: string, vector: number[], itemId = "item"): ChunkWithSource {
  return { chunkId: id, itemId, content: id, embedding: normalize(vector), title: null, sourceType: "note", url: null };
}

/** Turns off the per-item cap and relative window, to test one rule at a time. */
const ONLY_ABSOLUTE_RULES = { maxChunksPerItem: Infinity, relativeScoreWindow: Infinity };

const question = normalize([1, 0, 0]);
const chunks = [
  chunk("orthogonal", [0, 1, 0]), // 0
  chunk("exact", [1, 0, 0]), // 1
  chunk("close", [1, 0.3, 0]), // ≈0.958
  chunk("medium", [1, 1, 0]), // ≈0.707
  chunk("opposite", [-1, 0, 0]), // -1
];

describe("rankChunks", () => {
  it("returns matches best-first, limited to topK", () => {
    const { matches } = rankChunks(question, chunks, { topK: 2, minSimilarity: 0, ...ONLY_ABSOLUTE_RULES });
    expect(matches.map((m) => m.chunkId)).toEqual(["exact", "close"]);
    expect(matches[0]!.score).toBeCloseTo(1, 6);
  });

  it("drops chunks below minSimilarity", () => {
    const { matches } = rankChunks(question, chunks, { topK: 10, minSimilarity: 0.5, ...ONLY_ABSOLUTE_RULES });
    expect(matches.map((m) => m.chunkId)).toEqual(["exact", "close", "medium"]);
  });

  it("returns nothing when no chunk is similar enough", () => {
    expect(rankChunks(question, chunks, { topK: 5, minSimilarity: 1.01 }).matches).toEqual([]);
  });

  it("drops chunks far below the best match (relative window)", () => {
    const { matches } = rankChunks(question, chunks, { topK: 10, minSimilarity: 0.5, relativeScoreWindow: 0.1 });
    expect(matches.map((m) => m.chunkId)).toEqual(["exact", "close"]); // medium (≈0.71) is > 0.1 below 1.0
  });

  describe("per-item cap", () => {
    // A long page with 5 strong chunks, and a short note that scores a bit lower but still qualifies.
    const longPage = [0.99, 0.98, 0.97, 0.96, 0.95].map((x, i) => chunk(`page-${i}`, [x, 1 - x, 0], "page"));
    const note = chunk("note", [0.9, 0.3, 0], "note"); // ≈0.95
    const options = { topK: 5, minSimilarity: 0, maxChunksPerItem: 3, relativeScoreWindow: 0.1 };

    it("stops one item from filling every slot, so a slightly weaker item still gets in", () => {
      const { matches } = rankChunks(question, [...longPage, note], options);
      // Without the cap the result would be page-0…page-4. With it, the note takes a slot.
      expect(matches.map((m) => m.chunkId)).toContain("note");
      expect(matches.filter((m) => m.itemId === "page")).toHaveLength(4);
    });

    it("still returns topK chunks from one item when nothing else qualifies", () => {
      expect(rankChunks(question, longPage, options).matches).toHaveLength(5);
    });

    it("does not let a far weaker item displace strong chunks", () => {
      const weakNote = chunk("weak-note", [0.6, 0.8, 0], "note"); // ≈0.6, far below the page's ≈1.0
      const { matches } = rankChunks(question, [...longPage, weakNote], options);
      expect(matches.map((m) => m.chunkId)).not.toContain("weak-note");
      expect(matches).toHaveLength(5);
    });

    it("keeps the final list sorted best-first", () => {
      const scores = rankChunks(question, [...longPage, note], options).matches.map((m) => m.score);
      expect(scores).toEqual([...scores].sort((a, b) => b - a));
    });
  });

  it("skips and counts chunks embedded with a different vector size", () => {
    const result = rankChunks(question, [...chunks, chunk("other-model", [1, 0, 0, 0])], { topK: 10, minSimilarity: 0 });
    expect(result.skippedDimensionMismatch).toBe(1);
    expect(result.matches.map((m) => m.chunkId)).not.toContain("other-model");
  });
});
