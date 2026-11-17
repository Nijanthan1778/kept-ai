# Kept AI

Kept AI is an AI Knowledge Inbox built for the Turium AI Full Stack Developer assessment.

Save short notes or web pages, then ask questions about them. Answers come from a small RAG pipeline (chunk → embed → retrieve → generate) and cite the saved sources they were drawn from.

## Features

- **Save notes and URLs.** Pages are fetched server-side, with protection against server-side request forgery (SSRF), and the readable text is extracted.
- **Background ingestion.** `POST /ingest` returns `202 Accepted` immediately. Items move from `pending` to `ready` or `failed`, and the UI polls until they settle.
- **Semantic search.** Text is chunked at paragraph boundaries, embedded with Gemini and stored as vectors in SQLite.
- **Cited answers.** The model answers only from the retrieved sources and cites them as `[1]`, `[2]`. Each source card shows its snippet and similarity score, and whether the answer actually cited it.
- **Debuggable.** Logs are structured JSON with a request ID on every request (also returned as `X-Request-Id`). Each pipeline stage is timed. All errors share one response shape.

## Tech stack

| Layer | Choice |
|---|---|
| Backend | Node.js, Express 5, TypeScript (run with `tsx` in dev) |
| Storage | SQLite via `better-sqlite3` (one file: `server/data/kept.db`) |
| AI | Google Gemini through its OpenAI-compatible endpoint, called with the `openai` SDK |
| Validation / logging | `zod`, `pino` + `pino-http` |
| Extraction | `@mozilla/readability` + `jsdom` |
| Frontend | React 19, Vite, Tailwind CSS v4, shadcn/ui |
| Tests | `vitest` |

## Setup

You need Node.js 20.12 or newer (developed on Node 24) and a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey). The free tier is enough.

```bash
npm install
cp server/.env.example server/.env   # then set AI_API_KEY
npm run dev                          # API on :4000, UI on http://localhost:5173
```

The server refuses to start if the configuration is invalid, for example if `AI_API_KEY` is missing.

| Variable | Default | Purpose |
|---|---|---|
| `AI_API_KEY` | (required) | Gemini API key |
| `AI_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai/` | OpenAI-compatible endpoint |
| `EMBEDDING_MODEL` | `gemini-embedding-001` | Used for both chunks and questions |
| `CHAT_MODEL` | `gemini-3.5-flash-lite` | Answer generation (see the model note below) |
| `PORT` | `4000` | API port |
| `TOP_K` | `5` | Maximum number of sources passed to the model |
| `MIN_SIMILARITY` | `0.3` | Chunks scoring below this are never used |
| `LOG_LEVEL` | `info` | pino level |

Other commands:

```bash
npm test            # server unit tests
npm run typecheck   # server + client
npm run build       # compile server to server/dist, bundle client to client/dist
```

**Model note:** the default chat model is `gemini-3.5-flash-lite`, not `gemini-2.5-flash`. Google deprecated `gemini-2.5-flash` with a shutdown date of 2026-12-01 and lists `gemini-3.5-flash-lite` as its replacement. Any chat model on the endpoint works through `CHAT_MODEL`.

## API

All endpoints accept and return JSON. Every error uses one shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid request: content cannot be empty", "details": [{ "field": "content", "message": "content cannot be empty" }] } }
```

| Status | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Body fails validation; `details` lists every invalid field |
| 400 | `INVALID_JSON` | Body is not valid JSON |
| 404 | `NOT_FOUND` | Unknown route |
| 413 | `PAYLOAD_TOO_LARGE` | Body over 100 KB |
| 502 | `UPSTREAM_ERROR` | The AI service failed after retries; the message says why (rate limit, bad key, model not found…) |
| 500 | `INTERNAL_ERROR` | Anything unexpected; details are logged, never sent to the client |

### `POST /ingest`

```bash
curl -X POST localhost:4000/ingest -H 'content-type: application/json' \
  -d '{"type":"url","url":"https://en.wikipedia.org/wiki/Retrieval-augmented_generation"}'
```

The body is either `{ "type": "note", "content": string }` (1–20,000 characters after trimming) or `{ "type": "url", "url": string }` (http/https only). The response is `202 Accepted`:

```json
{
  "item": {
    "id": "9bdf8d95-12e4-4b95-a95a-d27aa75a6416",
    "sourceType": "url",
    "url": "https://en.wikipedia.org/wiki/Retrieval-augmented_generation",
    "title": null,
    "status": "pending",
    "errorMessage": null,
    "createdAt": "2026-11-17T15:19:07.689Z",
    "preview": null
  }
}
```

Problems found during background processing (unreachable page, private address, page needs JavaScript, AI failure) don't fail this request. The item ends up with `status: "failed"` and a readable `errorMessage`.

### `GET /items`

The response is `200`: `{ "items": Item[] }`, newest first. Each item has the shape shown above. `preview` holds the first ~200 characters of the content; the full text is never sent.

### `POST /query`

```bash
curl -X POST localhost:4000/query -H 'content-type: application/json' \
  -d '{"question":"What problem does RAG solve?"}'
```

The body is `{ "question": string }` (1–1,000 characters after trimming). The response is `200`:

```json
{
  "answer": "RAG lets a language model draw on external documents at answer time, which reduces hallucinations and avoids retraining when information changes [1][2].",
  "sources": [
    {
      "index": 1,
      "itemId": "9bdf8d95-…",
      "chunkId": "0b6c2a51-…",
      "title": "Retrieval-augmented generation",
      "sourceType": "url",
      "url": "https://en.wikipedia.org/wiki/Retrieval-augmented_generation",
      "snippet": "Retrieval-augmented generation (RAG) is a technique that enables large language models…",
      "score": 0.812,
      "cited": true
    }
  ]
}
```

`index` is the number used in the answer's `[n]` markers. `score` is the cosine similarity to the question. `cited` says whether the answer actually references that source; a source can be retrieved without being cited.

If nothing is saved yet, or no chunk reaches `MIN_SIMILARITY`, the endpoint returns `"I couldn't find anything relevant in your saved content…"` with `sources: []` and **does not call the LLM**.

## Architecture

```
                      ┌────────────── server ──────────────────────────────────────┐
React UI ── /api ──▶  │ routes/   validate (zod) → call service → respond          │
 (Vite proxy)         │ services/ ingestion · extractor · chunker · embeddings     │
                      │           retrieval · answer · query                       │
                      │ db/       itemsRepo · chunksRepo (all SQL lives here)      │
                      │ ai/       one OpenAI-SDK client pointed at Gemini          │
                      │ lib/      errors · logging · retry · job queue · URL safety│
                      └────────────────────────────────────────────────────────────┘
```

Routes stay thin, and services hold the logic without knowing about HTTP. Dependencies are created once in `index.ts` and passed in, so any piece can be swapped out in tests.

**Ingestion** (background, at most 2 items processed at once):

```
POST /ingest → insert item (pending) → 202
                     │
                     ▼ job queue
   URL? fetch (SSRF check per hop, 10s, 5MB, html/text only) → Readability → save title + text
                     ▼
   chunk (~2,000 chars, ~300 overlap) → embed in batches of 100 (with retry)
                     ▼
   one transaction: replace chunks + status=ready        any error → status=failed + readable message
```

Each item logs `fetchMs`, `chunkMs`, `embedMs`, `storeMs` and `totalMs`. On startup, items still `pending` (left over from a crash or restart) are queued again. Re-processing is idempotent: an item's chunks are replaced, never appended.

**Query:**

```
POST /query → no ready content? → canned answer (no AI calls)
            → embed question → cosine similarity vs every ready chunk → filter MIN_SIMILARITY → TOP_K
            → none left? → canned answer (no LLM call)
            → prompt with numbered sources → LLM → parse [n] citations → answer + sources
```

Each query logs `embedMs`, `retrieveMs`, `generateMs` and `citedCount`, under the request's ID.

## Design decisions and tradeoffs

### Chunking

The chunker splits recursively: first at paragraph breaks, then line breaks, then sentence ends, then spaces, and hard-cuts only an unbroken run longer than a chunk. It then packs the pieces into chunks of up to about 2,000 characters (roughly 500 tokens), with about 300 characters of overlap.

- **Why paragraph boundaries first:** a chunk should hold one complete idea. Cutting mid-paragraph produces fragments that match a question's words but can't answer it.
- **Why ~500 tokens:** smaller chunks retrieve more precisely and give short, readable snippets. Larger chunks carry more context per hit. 500 tokens is a common middle ground, and it is well under the embedding model's 2,048-token input limit.
- **Why overlap:** a fact that straddles a chunk boundary can still be retrieved from a single chunk. Overlap is built from whole pieces, so if the last paragraph is longer than the overlap budget there is none. That is acceptable because the cut then falls cleanly between paragraphs.
- **Title prefix:** each chunk is embedded as `title + "\n\n" + chunk`. A chunk from the middle of a page often never names its topic, and the title supplies it. Only the chunk itself is stored and shown.
- **Offsets:** each chunk stores its `start_offset` and `end_offset` in the original text, so a source can be traced back exactly.

### Vector store: SQLite and brute-force cosine similarity

Embeddings are stored as `Float32Array` BLOBs, normalized to length 1 so that cosine similarity is a plain dot product. Search loads every ready chunk and scores all of them.

- **Why:** there's no extra infrastructure; the database is one file and the code is easy to read. Results are exact, with no index to build or tune. At personal-inbox scale (thousands of chunks), a query takes milliseconds.
- **Cost:** O(n·d) time and memory for every query, and all vectors are loaded into memory for each one. That's fine at this scale and is the first thing to replace as it grows.
- **Same embedding model for documents and questions:** vectors from different models can't be compared. If `EMBEDDING_MODEL` changes, everything must be re-embedded. Retrieval detects chunks with a different vector size, skips them, and logs a warning instead of failing silently.

### Async ingestion: in-process queue and polling

Ingestion runs in the same Node process on a small in-memory queue (concurrency 2). The client polls `GET /items` every 2 s, and only while some item is `pending`.

- **Why:** it meets "don't block the request" with no Redis, worker processes or WebSockets. The low concurrency keeps a burst of new items from running into the free tier's rate limits.
- **Limits:** queued jobs are lost if the process dies. Startup recovery re-queues items left `pending`, so nothing is lost permanently, but there are no job-level retries, priorities or visibility. Polling is simple but wasteful compared with server-sent events.

### AI provider: the OpenAI SDK pointed at Gemini

Gemini's OpenAI-compatible endpoint means switching provider (OpenAI, a local model, Azure) is a config change: `AI_BASE_URL`, the model names and the key. The SDK also provides typed errors, which become specific 502 messages. The tradeoff is that Google marks the compatibility layer as beta, and it doesn't expose Gemini's embedding `task_type` (a hint that a text is a stored document or a search query), which can improve retrieval slightly. The SDK's built-in retries (0.5 s, then 1 s) are turned off in favour of a logged `withRetry`: 3 attempts with 2 s and 4 s backoff that honours `Retry-After`, which suits per-minute rate limits better.

### Answer generation

- The system prompt allows only the numbered sources, requires inline `[n]` citations, and tells the model to say plainly when the sources don't cover the question.
- Source text is labelled as data, so instructions inside a fetched page are ignored (a prompt-injection defence).
- Wikipedia-style `[12]` footnote markers are stripped from web pages before prompting, so they can't be confused with source citations. Notes are sent unchanged, so code like `arr[0]` stays intact.
- Citations are parsed from the answer (`[1]`, `[1][2]` and `[1, 2]` are all handled). Numbers that don't match a source are ignored, both for the `cited` flags and for the links in the UI.

### URL safety

User-supplied URLs are fetched by the server, so `lib/urlSafety.ts` checks that every address the hostname resolves to is public. It rejects loopback, private, link-local (including cloud metadata at `169.254.169.254`), carrier-grade NAT, multicast and reserved ranges, for both IPv4 and IPv6. Redirects are followed manually so each hop is checked again. Other limits: 10 s timeout for the whole download, a 5 MB streaming cap, `text/html` or `text/plain` only, and stored text capped at 100,000 characters (about 50 chunks).

### What breaks at scale

- **Search is O(n) per query.** Every query loads and scores every vector, so latency and memory grow linearly with saved content.
- **SQLite has a single writer.** WAL mode lets reads continue during writes, but write throughput is limited to one process on one machine.
- **In-process jobs.** They are lost on a crash (only partly covered by startup recovery), there's no horizontal scaling, and slow fetches hold queue slots.
- **No deduplication.** Saving the same URL twice stores and embeds it twice, and both copies then compete in retrieval.
- **Changing the embedding model** requires re-embedding everything.
- **Free-tier rate limits.** Large pages produce many embedding calls, and many questions at once will hit 429s; the retries soften this but don't remove it.
- **Polling.** Every open tab polls while items are pending.

### What I'd change for production

- **Retrieval:** Postgres with `pgvector` (an HNSW index), or a dedicated vector database. Hybrid search (BM25 plus vectors, merged with reciprocal-rank fusion) handles exact terms and names that embeddings miss. A reranker would reorder the top candidates.
- **Ingestion:** a durable queue (e.g. BullMQ on Redis) with retries, dead-lettering and separate workers. Deduplicate by URL or content hash. Store the embedding model and version with each chunk so re-indexing can be planned.
- **Quality:** an evaluation set of question–answer pairs with expected sources, run in CI (retrieval recall@k, citation accuracy, answer faithfulness), and `MIN_SIMILARITY` calibrated against it.
- **Security:** pin the DNS-checked IP in the HTTP agent to close the DNS-rebinding gap (see the limitations); add rate limiting per client; add authentication and per-user data separation.
- **Operations:** metrics and tracing (OpenTelemetry) for stage latencies, error rates and token usage, versioned database migrations, and streaming answers (server-sent events) for faster first output.

### Known limitations

- **Only tested against stubs.** I built and tested this without a Gemini key. Every AI code path (batching, retries, error mapping, citations) was checked against local OpenAI-compatible stub servers, and the UI was checked in a real browser against them. Two things still need confirming with a real key:
  - that the endpoint accepts a batch of 100 inputs per embeddings call;
  - what `MIN_SIMILARITY` should be. Gemini embeddings are known to give fairly high cosine scores even for unrelated texts, so if unrelated questions still retrieve sources, raise it (probably to 0.5–0.6).
- **JavaScript-rendered pages.** Single-page apps and pages behind logins come back with almost no text and are marked `failed` with that explanation. There's no headless browser.
- **Unsupported content.** PDFs and other non-HTML content are rejected.
- **Single user, no auth.** This is by design for the assignment.
- **DNS rebinding.** The SSRF check resolves DNS, then `fetch()` resolves it again. A hostile DNS server could answer differently the second time. The production fix is pinning the checked IP in the HTTP agent.
- **Plain-text answers.** Answers are not rendered as Markdown; any Markdown the model writes is shown as-is.

## Project structure

```
server/src/
  index.ts            bootstrap: builds the dependencies and starts the server
  app.ts              Express app: middleware, routes, error handler
  config.ts           environment loading and validation (fails fast)
  routes/             ingest, items, query, health (thin)
  schemas/            zod request schemas
  services/           ingestion pipeline, extractor, pageFetcher, chunker,
                      embeddings, retrieval, answer, query
  ai/client.ts        Gemini via the OpenAI SDK, retry policy, error mapping
  db/                 connection, schema, itemsRepo, chunksRepo
  domain/             shared item and chunk types
  lib/                errors, error handler, logging, retry, job queue, timing,
                      vector maths, URL safety
server/tests/         chunker, vector maths, URL safety, schemas, citations, ranking
client/src/
  api/                typed fetch wrapper and response types
  hooks/              useItems (pending-only polling), useAskQuestion, useAsyncAction
  components/         IngestForm, ItemList, ItemStatusBadge, AskBox, AnswerView, SourceCard
```
