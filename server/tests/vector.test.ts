import { describe, expect, it } from "vitest";
import { blobToVector, cosineSimilarityOfNormalized, normalize, vectorToBlob } from "../src/lib/vector.js";

const length = (v: Float32Array) => Math.hypot(...v);

describe("normalize", () => {
  it("scales a vector to unit length, keeping its direction", () => {
    const v = normalize([3, 4]);
    expect(length(v)).toBeCloseTo(1, 6);
    expect(v[0]).toBeCloseTo(0.6, 6);
    expect(v[1]).toBeCloseTo(0.8, 6);
  });

  it("leaves a zero vector as zeros instead of producing NaN", () => {
    expect([...normalize([0, 0, 0])]).toEqual([0, 0, 0]);
  });
});

describe("cosineSimilarityOfNormalized", () => {
  it("is 1 for the same direction, 0 for orthogonal, -1 for opposite", () => {
    const x = normalize([1, 0]);
    expect(cosineSimilarityOfNormalized(x, normalize([5, 0]))).toBeCloseTo(1, 6);
    expect(cosineSimilarityOfNormalized(x, normalize([0, 2]))).toBeCloseTo(0, 6);
    expect(cosineSimilarityOfNormalized(x, normalize([-3, 0]))).toBeCloseTo(-1, 6);
  });

  it("equals the textbook cosine formula for normalised inputs", () => {
    const a = [1, 2, 3];
    const b = [4, -1, 2];
    const dot = a.reduce((sum, ai, i) => sum + ai * b[i]!, 0);
    const expected = dot / (Math.hypot(...a) * Math.hypot(...b));
    expect(cosineSimilarityOfNormalized(normalize(a), normalize(b))).toBeCloseTo(expected, 6);
  });

  it("rejects vectors of different lengths", () => {
    expect(() => cosineSimilarityOfNormalized(normalize([1, 0]), normalize([1, 0, 0]))).toThrow(/length mismatch/);
  });
});

describe("BLOB round trip", () => {
  it("restores the exact float32 values", () => {
    const v = normalize([0.1, -0.25, 3, 7.5]);
    expect([...blobToVector(vectorToBlob(v))]).toEqual([...v]);
  });

  it("handles a Buffer that is not 4-byte aligned", () => {
    const v = normalize([1, 2, 3]);
    const padded = Buffer.concat([Buffer.from([0xff]), vectorToBlob(v)]);
    const unaligned = padded.subarray(1); // byteOffset 1: a direct Float32Array view would throw
    expect([...blobToVector(unaligned)]).toEqual([...v]);
  });
});
