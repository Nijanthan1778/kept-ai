import type { ItemsRepo } from "../db/itemsRepo.js";
import type { ItemWithContent } from "../domain/item.js";
import { IngestionError } from "../lib/errors.js";
import { createJobQueue } from "../lib/jobQueue.js";
import type { Logger } from "../lib/logger.js";
import { timed } from "../lib/timing.js";
import type { IngestRequest } from "../schemas/ingest.js";
import type { ExtractedContent } from "./extractor.js";

const NOTE_TITLE_MAX_CHARS = 80;
/** Items processed at the same time. Low on purpose: the embeddings API is rate-limited. */
const PROCESSING_CONCURRENCY = 2;
const UNEXPECTED_FAILURE_MESSAGE = "Something went wrong while processing this item. Please try adding it again.";

/** A note's title is its first non-empty line, shortened, so sources are recognisable in answers. */
export function deriveNoteTitle(content: string): string {
  const firstLine =
    content
      .split("\n")
      .find((line) => line.trim().length > 0)
      ?.replace(/\s+/g, " ")
      .trim() ?? "";
  return firstLine.length > NOTE_TITLE_MAX_CHARS
    ? `${firstLine.slice(0, NOTE_TITLE_MAX_CHARS - 1).trimEnd()}…`
    : firstLine;
}

interface IngestionDeps {
  itemsRepo: ItemsRepo;
  logger: Logger;
  fetchAndExtract: (url: string) => Promise<ExtractedContent>;
}

export function createIngestionService({ itemsRepo, logger, fetchAndExtract }: IngestionDeps) {
  const queue = createJobQueue(PROCESSING_CONCURRENCY, (err) =>
    logger.error({ err }, "Ingestion job crashed outside its own error handling"),
  );

  /** Returns the item's text, fetching it first for URL items that don't have it yet. */
  async function ensureContent(item: ItemWithContent, stageMs: Record<string, number>): Promise<string> {
    if (item.rawContent !== null) {
      return item.rawContent; // notes, or a URL already fetched before a restart
    }
    if (!item.url) {
      throw new Error(`Item ${item.id} has neither content nor a URL`);
    }
    const { value: extracted, ms } = await timed(() => fetchAndExtract(item.url!));
    stageMs.fetchMs = ms;
    itemsRepo.saveExtractedContent(item.id, { title: extracted.title, rawContent: extracted.text });
    if (extracted.truncated) {
      logger.warn({ itemId: item.id, keptChars: extracted.text.length }, "Page text truncated to the size limit");
    }
    return extracted.text;
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
      const content = await ensureContent(item, stageMs);
      log.info({ contentChars: content.length, stageMs }, "Content ready; chunking and embedding not built yet");
    } catch (err) {
      // Users see only messages we wrote; the full error (with cause chain) goes to the log.
      const userMessage = err instanceof IngestionError ? err.message : UNEXPECTED_FAILURE_MESSAGE;
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
