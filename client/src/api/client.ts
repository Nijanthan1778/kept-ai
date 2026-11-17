import type { ApiErrorBody, IngestInput, Item, QueryResult } from './types'

// In dev, Vite proxies /api to the server (see vite.config.ts).
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

/** An API failure with the server's error code and message, ready to show in the UI. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown
  /** Matches the server log entry for this request (X-Request-Id). */
  readonly requestId: string | null

  constructor(status: number, code: string, message: string, details?: unknown, requestId: string | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.requestId = requestId
  }
}

function isApiErrorBody(body: unknown): body is ApiErrorBody {
  return typeof body === 'object' && body !== null && 'error' in body
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Is it running?')
  }

  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const requestId = response.headers.get('x-request-id')
    if (isApiErrorBody(body)) {
      const { code, message, details } = body.error
      throw new ApiError(response.status, code, message, details, requestId)
    }
    throw new ApiError(response.status, 'HTTP_ERROR', `Request failed with HTTP ${response.status}`, undefined, requestId)
  }
  return body as T
}

export const api = {
  async listItems(): Promise<Item[]> {
    const { items } = await request<{ items: Item[] }>('/items')
    return items
  },

  async ingest(input: IngestInput): Promise<Item> {
    const { item } = await request<{ item: Item }>('/ingest', { method: 'POST', body: JSON.stringify(input) })
    return item
  },

  ask(question: string): Promise<QueryResult> {
    return request<QueryResult>('/query', { method: 'POST', body: JSON.stringify({ question }) })
  },
}

/** A user-facing message for any thrown value. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return 'Something went wrong.'
}
