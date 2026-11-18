import type { ChunksRepo } from "../db/chunksRepo.js";
import type { RunInTransaction } from "../db/connection.js";
import type { ItemsRepo } from "../db/itemsRepo.js";
import type { ItemWithContent } from "../domain/item.js";
import { AppError, IngestionError } from "../lib/errors.js";
import { createJobQueue } from "../lib/jobQueue.js";
import type { Logger } from "../lib/logger.js";
import { firstLineTitle } from "../lib/text.js";
import { timed } from "../lib/timing.js";
import type { IngestRequest } from "../schemas/ingest.js";
import { chunkText, type TextChunk } from "./chunker.js";
import type { EmbeddingService } from "./embeddings.js";
import type { ExtractedContent } from "./extractor.js";

const NOTE_TITLE_MAX_CHARS = 80;
/** Items processed at the same time. Low on purpose: the embeddings API is rate-limited. */
const PROCESSING_CONCURRENCY = 2;
const UNEXPECTED_FAILURE_MESSAGE = "Something went wrong while processing this item. Please try adding it again.";

/** A note's title is its first non-empty line, shortened, so sources are recognisable in answers. */
export function deriveNoteTitle(content: string): string {
  return firstLineTitle(content, NOTE_TITLE_MAX_CHARS);
}

/**
 * The text that gets embedded for a chunk: the item title, then the chunk. A chunk from the
 * middle of a page often never names its topic; the title supplies it. Only the chunk itself
 * is stored and shown as a snippet.
 */
export function textForEmbedding(title: string | null, chunk: TextChunk): string {
  return title ? `${title}\n\n${chunk.content}` : chunk.content;
}

interface IngestionDeps {
  itemsRepo: ItemsRepo;
  chunksRepo: ChunksRepo;
  runInTransaction: RunInTransaction;
  embeddings: EmbeddingService;
  fetchAndExtract: (url: string) => Promise<ExtractedContent>;
  logger: Logger;
}

export function createIngestionService({
  itemsRepo,
  chunksRepo,
  runInTransaction,
  embeddings,
  fetchAndExtract,
  logger,
}: IngestionDeps) {
  const queue = createJobQueue(PROCESSING_CONCURRENCY, (err) =>
    logger.error({ err }, "Ingestion job crashed outside its own error handling"),
  );

  /** Returns the item's title and text, fetching the page first for URL items that don't have it yet. */
  async function ensureContent(
    item: ItemWithContent,
    stageMs: Record<string, number>,
  ): Promise<{ title: string | null; text: string }> {
    if (item.rawContent !== null) {
      return { title: item.title, text: item.rawContent }; // notes, or a URL fetched before a restart
    }
    if (!item.url) {
      throw new Error(`Item ${item.id} has neither content nor a URL`);
    }
    itemsRepo.setProcessingStage(item.id, "fetching");
    const { value: extracted, ms } = await timed(() => fetchAndExtract(item.url!));
    stageMs.fetchMs = ms;
    itemsRepo.saveExtractedContent(item.id, { title: extracted.title, rawContent: extracted.text });
    if (extracted.truncated) {
      logger.warn({ itemId: item.id, keptChars: extracted.text.length }, "Page text truncated to the size limit");
    }
    return { title: extracted.title ?? item.title, text: extracted.text };
  }

  /** Runs the whole pipeline for one item. Never throws: every failure ends as status `failed`. */
  async function processItem(itemId: string): Promise<void> {
    const log = logger.child({ itemId });
    const stageMs: Record<string, number> = {};
    const started = performance.now();

    try {
      const item = itemsRepo.findWithContent(itemId);
      if (!item) {
        log.warn("Item disappeared before processing");
        return;
      }
      const { title, text } = await ensureContent(item, stageMs);

      itemsRepo.setProcessingStage(itemId, "chunking");
      const { value: chunks, ms: chunkMs } = await timed(() => chunkText(text));
      stageMs.chunkMs = chunkMs;
      if (chunks.length === 0) {
        throw new IngestionError("This item has no text to index");
      }

      itemsRepo.setProcessingStage(itemId, "embedding");
      const { value: vectors, ms: embedMs } = await timed(() =>
        embeddings.embedTexts(chunks.map((chunk) => textForEmbedding(title, chunk))),
      );
      stageMs.embedMs = embedMs;

      itemsRepo.setProcessingStage(itemId, "saving");
      // Chunks and the `ready` status commit together: an item is never `ready` with missing chunks.
      const { value: stored, ms: storeMs } = await timed(() =>
        runInTransaction(() => {
          // The user may have removed the item while it was being fetched or embedded.
          if (!itemsRepo.exists(itemId)) return false;
          chunksRepo.replaceForItem(
            itemId,
            chunks.map((chunk, i) => ({ ...chunk, embedding: vectors[i]! })),
          );
          itemsRepo.markReady(itemId);
          return true;
        }),
      );
      stageMs.storeMs = storeMs;

      if (!stored) {
        log.info({ stageMs }, "Item was removed during processing; discarded its chunks");
        return;
      }

      log.info(
        { chunkCount: chunks.length, contentChars: text.length, stageMs, totalMs: Math.round(performance.now() - started) },
        "Item ready",
      );
    } catch (err) {
      // Users see only messages we wrote (IngestionError, or AppError such as UpstreamError);
      // the full error with its cause chain goes to the log.
      const userMessage =
        err instanceof IngestionError || err instanceof AppError ? err.message : UNEXPECTED_FAILURE_MESSAGE;
      log.error({ err, stageMs, totalMs: Math.round(performance.now() - started) }, "Ingestion failed");
      itemsRepo.markFailed(itemId, userMessage);
    }
  }

  function enqueue(itemId: string): void {
    queue.push(() => processItem(itemId));
  }

  return {
    /**
     * Saves the item as `pending` and returns straight away. The slow work (fetching,
     * chunking, embedding) happens in the background and moves it to `ready` or `failed`.
     */
    ingest(request: IngestRequest): ItemWithContent {
      const item =
        request.type === "note"
          ? itemsRepo.insert({
              sourceType: "note",
              url: null,
              title: deriveNoteTitle(request.content),
              rawContent: request.content,
            })
          : itemsRepo.insert({ sourceType: "url", url: request.url, title: null, rawContent: null });

      logger.info({ itemId: item.id, sourceType: item.sourceType }, "Item accepted for ingestion");
      enqueue(item.id);
      return item;
    },

    /**
     * Re-queues items left `pending` by a previous run (crash or restart mid-processing).
     * Needed because the queue is in memory.
     */
    resumePendingItems(): number {
      const pendingIds = itemsRepo.listIdsByStatus("pending");
      pendingIds.forEach(enqueue);
      return pendingIds.length;
    },
  };
}

export type IngestionService = ReturnType<typeof createIngestionService>;
