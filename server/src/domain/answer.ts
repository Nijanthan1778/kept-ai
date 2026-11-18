import type { SourceType } from "./item.js";

/** A retrieved chunk as shown to the user next to an answer. */
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
