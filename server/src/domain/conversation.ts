import type { QuerySource } from "./answer.js";

/** One answered question in a conversation, with the sources exactly as they were shown. */
export interface ConversationTurn {
  id: string;
  question: string;
  answer: string;
  /** A snapshot: stays readable even if the cited items are removed later. */
  sources: QuerySource[];
  createdAt: string;
}

/** A conversation as listed in the history drawer, without its turns. */
export interface ConversationSummary {
  id: string;
  title: string;
  turnCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  turns: ConversationTurn[];
}
