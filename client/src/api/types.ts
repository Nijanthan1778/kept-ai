// Response shapes of the Kept AI API. These mirror the server's DTOs
// (server/src/routes/itemDto.ts and server/src/services/query.ts).

export type SourceType = 'note' | 'url'
export type ItemStatus = 'pending' | 'ready' | 'failed'

export interface Item {
  id: string
  sourceType: SourceType
  url: string | null
  title: string | null
  status: ItemStatus
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

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown }
}
