/**
 * Vectors are stored L2-normalised (length 1). For unit vectors, cosine similarity equals the
 * plain dot product, so search is one multiply-add loop per chunk with no square roots.
 */

export function normalize(values: ArrayLike<number>): Float32Array {
  const vector = Float32Array.from(values);
  let sumOfSquares = 0;
  for (const v of vector) sumOfSquares += v * v;
  const length = Math.sqrt(sumOfSquares);
  if (length === 0) return vector; // a zero vector has no direction; leave it as is
  for (let i = 0; i < vector.length; i++) vector[i]! /= length;
  return vector;
}

/** Cosine similarity of two already-normalised vectors: 1 = same direction, 0 = unrelated. */
export function cosineSimilarityOfNormalized(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!;
  return dot;
}

/** Raw float32 bytes for a SQLite BLOB column (4 bytes per dimension). */
export function vectorToBlob(vector: Float32Array): Buffer {
  return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
}

export function blobToVector(blob: Buffer): Float32Array {
  // Copy into a fresh buffer: Float32Array needs 4-byte alignment, which a Buffer slice may not have.
  const copy = new Uint8Array(blob);
  return new Float32Array(copy.buffer, 0, copy.byteLength / Float32Array.BYTES_PER_ELEMENT);
}
