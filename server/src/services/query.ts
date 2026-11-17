import type { ScoredChunk } from "../domain/chunk.js";
import type { SourceType } from "../domain/item.js";
import type { Logger } from "../lib/logger.js";
import { timed } from "../lib/timing.js";
import { findCitedSourceNumbers, type AnswerService } from "./answer.js";
import type { EmbeddingService } from "./embeddings.js";
import type { RetrievalService } from "./retrieval.js";

export const NO_RELEVANT_CONTENT_ANSWER =
  "I couldn't find anything relevant in your saved content. Try rephrasing, or save a note or URL that covers it.";

export interface QuerySource {
  /** The 1-based number used for this source in the answer's [n] citations. */
  index: number;
  itemId: string;
  chunkId: string;
  title: string | null;
  sourceType: SourceType;
  url: string | null;
  snippet: string;
  score: number;
  /** Whether the answer actually cites this source (it may have been retrieved but not used). */
  cited: boolean;
}

export interface QueryResult {
  answer: string;
  sources: QuerySource[];
}

const NOTHING_FOUND: QueryResult = { answer: NO_RELEVANT_CONTENT_ANSWER, sources: [] };

function toSource(chunk: ScoredChunk, index: number, cited: Set<number>): QuerySource {
  return {
    index,
    itemId: chunk.itemId,
    chunkId: chunk.chunkId,
    title: chunk.title,
    sourceType: chunk.sourceType,
    url: chunk.url,
    snippet: chunk.content,
    score: Math.round(chunk.score * 1000) / 1000,
    cited: cited.has(index),
  };
}

interface QueryDeps {
  embeddings: EmbeddingService;
  retrieval: RetrievalService;
  answers: AnswerService;
}

/** The query flow: embed the question → find relevant chunks → answer from them with citations. */
export function createQueryService({ embeddings, retrieval, answers }: QueryDeps) {
  return {
    async answerQuestion(question: string, log: Logger): Promise<QueryResult> {
      if (!retrieval.hasSearchableContent()) {
        log.info("No ready items to search; answered without calling the AI service");
        return NOTHING_FOUND;
      }

      const embedded = await timed(() => embeddings.embedQuery(question));
      const retrieved = await timed(() => retrieval.findRelevantChunks(embedded.value, log));
      const stageMs: Record<string, number> = { embedMs: embedded.ms, retrieveMs: retrieved.ms };
      const chunks = retrieved.value;

      if (chunks.length === 0) {
        log.info({ stageMs }, "No chunk passed the similarity threshold; skipped answer generation");
        return NOTHING_FOUND;
      }

      const generated = await timed(() => answers.generateAnswer(question, chunks, log));
      stageMs.generateMs = generated.ms;

      const cited = findCitedSourceNumbers(generated.value, chunks.length);
      log.info(
        { stageMs, sourceCount: chunks.length, citedCount: cited.size, topScore: chunks[0]!.score },
        "Question answered",
      );
      return {
        answer: generated.value,
        sources: chunks.map((chunk, i) => toSource(chunk, i + 1, cited)),
      };
    },
  };
}

export type QueryService = ReturnType<typeof createQueryService>;
