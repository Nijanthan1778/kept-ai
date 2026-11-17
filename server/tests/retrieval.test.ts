import { describe, expect, it } from "vitest";
import type { ChunkWithSource } from "../src/domain/chunk.js";
import { normalize } from "../src/lib/vector.js";
import { rankChunks } from "../src/services/retrieval.js";

function chunk(id: string, vector: number[]): ChunkWithSource {
  return { chunkId: id, itemId: "item", content: id, embedding: normalize(vector), title: null, sourceType: "note", url: null };
}

const question = normalize([1, 0, 0]);
const chunks = [
  chunk("orthogonal", [0, 1, 0]),
  chunk("exact", [1, 0, 0]),
  chunk("close", [1, 0.3, 0]),
  chunk("medium", [1, 1, 0]),
  chunk("opposite", [-1, 0, 0]),
];

describe("rankChunks", () => {
  it("returns matches best-first, limited to topK", () => {
    const { matches } = rankChunks(question, chunks, { topK: 2, minSimilarity: 0 });
    expect(matches.map((m) => m.chunkId)).toEqual(["exact", "close"]);
    expect(matches[0]!.score).toBeCloseTo(1, 6);
  });

  it("drops chunks below minSimilarity", () => {
    const { matches } = rankChunks(question, chunks, { topK: 10, minSimilarity: 0.5 });
    expect(matches.map((m) => m.chunkId)).toEqual(["exact", "close", "medium"]);
  });

  it("returns nothing when no chunk is similar enough", () => {
    expect(rankChunks(question, chunks, { topK: 5, minSimilarity: 1.01 }).matches).toEqual([]);
  });

  it("skips and counts chunks embedded with a different vector size", () => {
    const result = rankChunks(question, [...chunks, chunk("other-model", [1, 0, 0, 0])], { topK: 10, minSimilarity: 0 });
    expect(result.skippedDimensionMismatch).toBe(1);
    expect(result.matches.map((m) => m.chunkId)).not.toContain("other-model");
  });
});
