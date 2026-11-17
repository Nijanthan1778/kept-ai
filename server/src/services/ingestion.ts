import type { ItemsRepo } from "../db/itemsRepo.js";
import type { ItemWithContent } from "../domain/item.js";
import type { Logger } from "../lib/logger.js";
import type { IngestRequest } from "../schemas/ingest.js";

const NOTE_TITLE_MAX_CHARS = 80;

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
}

export function createIngestionService({ itemsRepo, logger }: IngestionDeps) {
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
      return item;
    },
  };
}

export type IngestionService = ReturnType<typeof createIngestionService>;
