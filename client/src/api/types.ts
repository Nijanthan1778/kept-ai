// Response shapes of the Kept AI API. These mirror the server's DTOs
// (server/src/routes/itemDto.ts and server/src/services/query.ts).

export type SourceType = 'note' | 'url'
export type ItemStatus = 'pending' | 'ready' | 'failed'
export type ProcessingStage = 'fetching' | 'chunking' | 'embedding' | 'saving'

export interface Item {
  id: string
  sourceType: SourceType
  url: string | null
  title: string | null
  status: ItemStatus
  /** Only while pending: what the background job is doing (null = queued, not started yet). */
  processingStage: ProcessingStage | null
  errorMessage: string | null
  createdAt: string
  preview: string | null
}

export type IngestInput = { type: 'note'; content: string } | { type: 'url'; url: string }

export interface QuerySource {
  index: number
  itemId: string
  chunkId: string
  title: string | null
  sourceType: SourceType
  url: string | null
  snippet: string
  score: number
  cited: boolean
}

export interface QueryResult {
  answer: string
  sources: QuerySource[]
}

/** POST /query also says which conversation (and turn) the answer was saved to. */
export interface QueryResponse extends QueryResult {
  conversationId: string
  turnId: string
}

export interface ConversationSummary {
  id: string
  title: string
  turnCount: number
  createdAt: string
  updatedAt: string
}

export interface ConversationTurn {
  id: string
  question: string
  answer: string
  sources: QuerySource[]
  createdAt: string
}

export interface Conversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  turns: ConversationTurn[]
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown }
}
