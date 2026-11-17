import { aiRetryPolicy, toUpstreamError, type AiClient } from "../ai/client.js";
import { UpstreamError } from "../lib/errors.js";
import type { Logger } from "../lib/logger.js";
import { withRetry } from "../lib/retry.js";
import { normalize } from "../lib/vector.js";

/** Gemini accepts at most 100 inputs per embedding request. */
export const EMBEDDING_BATCH_SIZE = 100;

interface EmbeddingDeps {
  client: AiClient;
  model: string;
  logger: Logger;
}

/**
 * Chunks and questions are embedded with the same model: vectors from different models live
 * in different spaces and can't be compared. Changing EMBEDDING_MODEL means re-embedding everything.
 */
export function createEmbeddingService({ client, model, logger }: EmbeddingDeps) {
  async function embedBatch(texts: string[]): Promise<Float32Array[]> {
    const response = await withRetry(
      // "float" explicitly: the SDK otherwise asks for base64, which Gemini doesn't document.
      () => client.embeddings.create({ model, input: texts, encoding_format: "float" }),
      aiRetryPolicy,
      ({ attempt, delayMs, err }) =>
        logger.warn({ attempt, delayMs, err, batchSize: texts.length }, "Embedding request failed; retrying"),
    );

    if (response.data.length !== texts.length) {
      throw new UpstreamError(
        `The AI service returned ${response.data.length} embeddings for ${texts.length} texts`,
      );
    }
    return [...response.data].sort((a, b) => a.index - b.index).map((item) => normalize(item.embedding));
  }

  /** Embeds texts in batches, one batch at a time to stay inside rate limits. Order is preserved. */
  async function embedTexts(texts: string[]): Promise<Float32Array[]> {
    const vectors: Float32Array[] = [];
    try {
      for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
        vectors.push(...(await embedBatch(texts.slice(i, i + EMBEDDING_BATCH_SIZE))));
      }
    } catch (err) {
      throw err instanceof UpstreamError ? err : toUpstreamError(err);
    }
    return vectors;
  }

  return {
    embedTexts,
    async embedQuery(question: string): Promise<Float32Array> {
      const [vector] = await embedTexts([question]);
      return vector!;
    },
  };
}

export type EmbeddingService = ReturnType<typeof createEmbeddingService>;
