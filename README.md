# Kept AI

Kept AI is an AI Knowledge Inbox built for the Turium AI Full Stack Developer assessment.

Save short notes or web pages, then ask questions about them. Answers come from a small RAG pipeline (chunk → embed → retrieve → generate) and cite the saved sources they were drawn from.

**Contents:** [Assignment checklist](#assignment-checklist) · [Quick start](#quick-start) · [Using the app](#using-the-app) · [API](#api) · [Architecture](#architecture) · [Design decisions and tradeoffs](#design-decisions-and-tradeoffs) · [Troubleshooting](#troubleshooting) · [Project structure](#project-structure)

## Assignment checklist

How each requirement of the Turium AI brief is met:

| Requirement | Where / how |
|---|---|
| **1. Content ingestion** | |
| Add text notes | `POST /ingest` with `{ "type": "note" }`; the **Add → Note** modal |
| Add URLs, fetched server-side | `{ "type": "url" }`; fetched with an SSRF guard, timeout and size cap, text extracted with Readability (`services/pageFetcher.ts`, `services/extractor.ts`) |
| Store raw content and metadata (timestamp, source type) | `items` table: `raw_content`, `source_type`, `created_at`, `updated_at`, `status` |
| No auth, single user | As specified |
| **2. Semantic search and RAG** | |
| Intentional chunking strategy | Recursive split on paragraphs → lines → sentences, ~2,000 chars with ~300 overlap ([rationale](#chunking)) |
| Embeddings | Gemini `gemini-embedding-001`, batched with retry (`services/embeddings.ts`) |
| Vector storage | SQLite BLOBs of normalised `Float32Array`s ([why](#vector-store-sqlite-and-brute-force-cosine-similarity)) |
| Retrieve the top chunks for a question | Cosine similarity, `MIN_SIMILARITY` and `TOP_K`, calibrated on real scores (`services/retrieval.ts`) |
| Pass context and question to the LLM | Numbered sources plus a grounding prompt (`services/answer.ts`) |
| Answer with cited sources | `[n]` citations parsed into `sources[].cited`; shown as footnotes and source cards |
| **3. Frontend** | |
| Note / URL input | **Add** modal with Note and URL tabs, and live processing progress |
| List saved items | **Saved items** drawer with status, errors and Remove |
| Ask question interface | Chat composer, suggestions, conversation history |
| Answer and source snippets | Answer with `[1, 2]` footnotes; "Show sources" opens snippet cards with scores |
| React with hooks, reasonable state management | `useItems`, `useConversations` and `useAsyncAction` own server state; components get props |
| **4. API design** | `POST /ingest`, `GET /items`, `POST /query` (plus delete and history endpoints), one error shape, zod validation, specific status codes ([API](#api)) |
| **Tradeoff awareness** | Chunking, vector store, what breaks at scale and production changes are all in [Design decisions and tradeoffs](#design-decisions-and-tradeoffs) |
| **Debuggability** | Structured pino logs with request IDs and per-stage timings; user-facing error messages; 202/204/400/404/413/502/500 |
| **Code quality** | Routes → services → repositories; small single-purpose files; 108 unit tests |
| **Tech constraints** | Node + Express, OpenAI-SDK-compatible API (Gemini), SQLite, React + Tailwind + shadcn; no auth, no containers or extra infrastructure |

## Features

- **Save notes and URLs.** Pages are fetched server-side, with protection against server-side request forgery (SSRF), and the readable text is extracted.
- **Background ingestion.** `POST /ingest` returns `202 Accepted` immediately. Items move from `pending` to `ready` or `failed`, and the UI polls until they settle.
- **Semantic search.** Text is chunked at paragraph boundaries, embedded with Gemini and stored as vectors in SQLite.
- **Cited answers.** The model answers only from the retrieved sources and cites them as `[1]`, `[2]`. Each source card shows its snippet and similarity score, and whether the answer actually cited it.
- **Chat-first UI.** The whole page is a conversation thread with the composer pinned at the bottom. Adding a note or URL opens a modal, and saved items open in a side drawer. Sources start collapsed under each answer; clicking a citation number opens them and jumps to the cited passage. It works from 320 px phones to desktop.
- **Chat history.** Every answered question is stored in SQLite as part of a conversation. A History drawer lists past conversations, newest activity first; you can reopen, continue or delete them, and they survive page refreshes. Each question is still answered on its own: the model doesn't see earlier turns.
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

## Quick start

### Prerequisites

- **Node.js 22.12 or newer** (developed and tested on Node 24). `better-sqlite3` and `vitest` don't support older versions. Check with `node -v`.
- **npm 10+** (comes with Node), and **Git**.
- **A Gemini API key.** It's free: sign in at [Google AI Studio](https://aistudio.google.com/apikey) and choose *Create API key*. No billing is needed for the free tier.
- Internet access (for `npm install`, the Gemini API and fetching saved URLs).

### Run it

```bash
git clone https://github.com/Nijanthan1778/kept-ai.git
cd kept-ai
npm install                          # installs the server and client (npm workspaces)
cp server/.env.example server/.env   # then open server/.env and paste your key after AI_API_KEY=
npm run dev                          # API on http://localhost:4000, UI on http://localhost:5173
```

Open **http://localhost:5173**. The SQLite database is created automatically at `server/data/kept.db` on first start; there's nothing else to install or migrate.

The server refuses to start if the configuration is invalid. For example, without a key it prints `AI_API_KEY: is required. Get a key from Google AI Studio and set it in server/.env` and exits. After editing `server/.env`, restart `npm run dev`.

| Variable | Default | Purpose |
|---|---|---|
| `AI_API_KEY` | (required) | Gemini API key |
| `AI_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai/` | OpenAI-compatible endpoint |
| `EMBEDDING_MODEL` | `gemini-embedding-001` | Used for both chunks and questions |
| `CHAT_MODEL` | `gemini-3.5-flash-lite` | Answer generation (see the model note below) |
| `PORT` | `4000` | API port |
| `TOP_K` | `5` | Maximum number of sources passed to the model |
| `MIN_SIMILARITY` | `0.55` | Chunks scoring below this are never used (calibrated for `gemini-embedding-001`; see below) |
| `LOG_LEVEL` | `info` | pino level |

Other commands:

```bash
npm test            # server unit tests (108; no API key or network needed)
npm run typecheck   # server + client
npm run build       # compile server to server/dist, bundle client to client/dist
```

**Model note:** the default chat model is `gemini-3.5-flash-lite`, not `gemini-2.5-flash`. Google deprecated `gemini-2.5-flash` with a shutdown date of 2026-12-01 and lists `gemini-3.5-flash-lite` as its replacement. Any chat model on the endpoint works through `CHAT_MODEL`.

## Using the app

**1. Add something to your inbox.** Click **+ Add** (top right).
- **Note tab:** type or paste text (up to 20,000 characters) and click **Save note**. The first line becomes its title.
- **URL tab:** paste a link such as `https://en.wikipedia.org/wiki/Retrieval-augmented_generation` and click **Save URL**. The server downloads the page and keeps its readable text.
- The modal shows live progress (*Fetching page → Splitting into chunks → Embedding chunks → Saving*) and closes by itself once the item is **Ready**. If something goes wrong, for example the page needs JavaScript or the link is private, it explains why.
- If you paste only a link into the Note tab, it offers **Save as URL**, so the page is fetched instead of the link being saved as text.

**2. Ask a question.** Type in the box at the bottom and press **Enter** (Shift+Enter adds a new line), or click one of the suggested questions.
- The answer is built **only** from your saved content. If nothing relevant is saved, it says so instead of guessing.
- Numbers like **[1, 2]** after a sentence are citations. Click a number, or **Show sources**, to see the exact passages used. Each card shows its similarity score and whether the answer cited it.

**3. Manage your content.** **Saved items** opens a drawer listing everything you've saved, with its status (Processing, Ready or Failed), the reason for any failure, and a **Remove** button.

**4. Revisit conversations.** **History** lists past conversations; click one to reopen and continue it, or use the trash icon to delete it. **New chat** starts a fresh conversation. Each question is answered on its own, so follow-ups like "tell me more about that" should name the topic.

**Good to know**
- Items become searchable only once they show **Ready**.
- Pages built with JavaScript (many Framer, Wix or single-page-app sites), pages behind a login, and PDFs can't be read. Copy their text into a note instead.
- Removing an item removes it from future answers. Old answers in History keep the snippets they were based on.

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
    "processingStage": null,
    "errorMessage": null,
    "createdAt": "2026-11-17T15:19:07.689Z",
    "preview": null
  }
}
```

Problems found during background processing (unreachable page, private address, page needs JavaScript, AI failure) don't fail this request. The item ends up with `status: "failed"` and a readable `errorMessage`.

### `GET /items`

The response is `200`: `{ "items": Item[] }`, newest first. Each item has the shape shown above. `preview` holds the first ~200 characters of the content; the full text is never sent.

While an item is `pending`, `processingStage` says what its background job is doing: `fetching` (URLs only), `chunking`, `embedding` or `saving`, and `null` while it is still queued. It goes back to `null` once the item is `ready` or `failed`. The UI turns it into a progress bar and a label ("Embedding chunks…").

### `DELETE /items/:id`

Removes an item and its chunks. The response is `204 No Content`, `404 NOT_FOUND` if the item doesn't exist, or `400 VALIDATION_ERROR` if `id` isn't a UUID. It's safe to call while the item is still processing: the pipeline checks that the item still exists in the same transaction that would store its chunks, and stops if it's gone.

```bash
curl -i -X DELETE localhost:4000/items/9bdf8d95-12e4-4b95-a95a-d27aa75a6416
```

### `POST /query`

```bash
curl -X POST localhost:4000/query -H 'content-type: application/json' \
  -d '{"question":"What problem does RAG solve?"}'
```

The body is `{ "question": string, "conversationId"?: string }`. The question is 1–1,000 characters after trimming. Pass `conversationId` to add the question to an existing conversation; leave it out to start a new one, titled after the question. An unknown `conversationId` returns `404`, and this is checked **before** any AI call. The response is `200`:

```json
{
  "conversationId": "6f1c2b9e-3d4a-4f5b-8c7d-1e2f3a4b5c6d",
  "turnId": "0d3e5a7b-…",
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

Every successful answer is saved as a turn of the conversation, including "nothing relevant" answers. A request that fails (e.g. `502` when the AI service is down) saves nothing; the UI keeps the question on screen with a Retry button.

### `GET /conversations`

The response is `200`: `{ "conversations": [{ "id", "title", "turnCount", "createdAt", "updatedAt" }] }`, ordered by most recent activity.

### `GET /conversations/:id`

The response is `200`: `{ "conversation": { "id", "title", "createdAt", "updatedAt", "turns": [{ "id", "question", "answer", "sources", "createdAt" }] } }`, with turns in the order they were asked. Each turn's `sources` is a snapshot taken when it was answered, so old answers keep their citations even after the cited item is removed. Returns `404` for an unknown ID and `400` for an ID that isn't a UUID.

### `DELETE /conversations/:id`

Deletes the conversation and its turns. The response is `204`, or `404` if the conversation doesn't exist.

## Architecture

```
                      ┌────────────── server ──────────────────────────────────────┐
React UI ── /api ──▶  │ routes/   validate (zod) → call service → respond          │
 (Vite proxy)         │ services/ ingestion · extractor · chunker · embeddings     │
                      │           retrieval · answer · query · conversations       │
                      │ db/       items · chunks · conversations repos (all SQL)   │
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
            → embed question → cosine similarity vs every ready chunk
            → keep ≥ MIN_SIMILARITY and within 0.10 of the best match → TOP_K, max 3 per item first
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

### Retrieval rules, calibrated against real Gemini scores

`gemini-embedding-001` gives fairly high cosine scores even for unrelated text, so the thresholds were set from measured scores rather than guessed. I saved a 4-sentence note, a Wikipedia article and a long essay (52 chunks), then asked related and unrelated questions:

| Question | Best match |
|---|---|
| "When and where is the offsite?" | 0.713 |
| "What is the budget per person?" | 0.603 |
| "Who leads the strategy workshop?" (weakest relevant) | 0.575 |
| "What problem does RAG solve?" | 0.745 |
| "What is the capital of Australia?" (unrelated) | 0.484 |
| "How do I bake sourdough bread?" (unrelated, the highest of these) | 0.519 |
| "Who won the 2022 FIFA World Cup?" (unrelated) | 0.478 |

Three rules come out of this:

1. **`MIN_SIMILARITY = 0.55`** sits between the highest unrelated score (0.519) and the lowest relevant best match (0.575). Unrelated questions get "nothing relevant found" **without an LLM call**. The margin is narrow, which is why it's configurable, and it needs re-checking if the embedding model changes.
2. **Relative window: chunks must also score within 0.10 of the question's best match.** With only an absolute threshold, merely topical chunks (0.55–0.57 from the essay) took slots even when much better matches (0.71+) existed. In the measurements, every source an answer needed was within 0.09 of the best match.
3. **At most 3 chunks per item in the first pass.** For "Who leads the workshop and what is RAG?", all 5 slots went to Wikipedia chunks (0.62–0.65), and the note that answers the first half (0.563) was dropped, so the answer said nothing about the workshop. With the cap the note gets a slot and the answer names the leader. Slots left over are refilled from the same item, so a question about a single long document still gets 5 chunks.

These are tuned on a small sample. In production I'd replace this with an evaluation set (see below).

### Async ingestion: in-process queue and polling

Ingestion runs in the same Node process on a small in-memory queue (concurrency 2). The client polls `GET /items` every 2 s, and only while some item is `pending`.

- **Why:** it meets "don't block the request" with no Redis, worker processes or WebSockets. The low concurrency keeps a burst of new items from running into the free tier's rate limits.
- **Limits:** queued jobs are lost if the process dies. Startup recovery re-queues items left `pending`, so nothing is lost permanently, but there are no job-level retries, priorities or visibility. Polling is simple but wasteful compared with server-sent events.

### AI provider: the OpenAI SDK pointed at Gemini

Gemini's OpenAI-compatible endpoint means switching provider (OpenAI, a local model, Azure) is a config change: `AI_BASE_URL`, the model names and the key. The SDK also provides typed errors, which become specific 502 messages. The tradeoff is that Google marks the compatibility layer as beta, and it doesn't expose Gemini's embedding `task_type` (a hint that a text is a stored document or a search query), which can improve retrieval slightly. The SDK's built-in retries (0.5 s, then 1 s) are turned off in favour of a logged `withRetry`: 3 attempts with 2 s and 4 s backoff that honours `Retry-After`, which suits per-minute rate limits better.

### Answer generation

- The system prompt allows only the numbered sources, requires inline `[n]` citations, and tells the model to say plainly when the sources don't cover the question.
- It allows reasoning over facts in the sources (calculations, comparisons, date differences) and asks the model to show its working. Without that, the model refused "What is the budget per person?" even though the note gives the total and the head count.
- It asks for plain text with `- ` bullets, because the UI doesn't render Markdown.
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

- **Retrieval thresholds are tuned on a small sample** (see "Retrieval rules"). They work for the tested content, but there's no evaluation set behind them.
- **Some error paths tested against stubs.** The happy path (batched embeddings, retrieval, cited answers) and the invalid-key error were tested against the real Gemini API. Rate-limit retries, timeouts and empty responses were tested against local OpenAI-compatible stubs, since they can't be triggered on demand; the error mapping itself is unit-tested.
- **JavaScript-rendered pages.** Single-page apps and pages behind logins come back with almost no text and are marked `failed` with that explanation. There's no headless browser.
- **Unsupported content.** PDFs and other non-HTML content are rejected.
- **Single user, no auth.** This is by design for the assignment.
- **DNS rebinding.** The SSRF check resolves DNS, then `fetch()` resolves it again. A hostile DNS server could answer differently the second time. The production fix is pinning the checked IP in the HTTP agent.
- **Plain-text answers.** Answers are not rendered as Markdown. The prompt asks for plain text, but if the model writes Markdown anyway it's shown as-is.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `npm install` fails building `better-sqlite3`, or `npm test` complains about the Node version | Node is older than 22.12. Upgrade Node, delete `node_modules`, run `npm install` again. |
| Server exits with `AI_API_KEY: is required…` | `server/.env` is missing or the key is empty. Run `cp server/.env.example server/.env` and paste your key. |
| Items fail with "The AI service rejected the API key" | The key is wrong or was revoked. Create a new one in Google AI Studio, update `server/.env`, and restart. |
| "The AI service rate limit was reached" | The free tier allows a limited number of requests per minute. Wait a minute and try again. |
| "The configured AI model was not found" | A model in `.env` isn't available to your key. Use the defaults from `.env.example`. |
| `EADDRINUSE` on port 4000 or 5173 | Something else uses the port. Stop it, or set `PORT` in `server/.env` and start with `API_TARGET=http://localhost:<PORT> npm run dev` so the UI's proxy follows. |
| A URL ends as Failed: "Couldn't find readable text…" | The page builds its content with JavaScript or needs a login. Paste the text as a note instead. |
| Unrelated questions still list sources | `MIN_SIMILARITY` in `server/.env` is lower than the calibrated `0.55`. |
| `npm install` reports moderate vulnerabilities | They come from the shadcn CLI's development tooling, which isn't shipped to the browser. `npm audit fix --force` would break the setup; leave them. |

To start over with an empty inbox, stop the server and delete `server/data/` (it's recreated on the next start).

## Project structure

```
server/src/
  index.ts            bootstrap: builds the dependencies and starts the server
  app.ts              Express app: middleware, routes, error handler
  config.ts           environment loading and validation (fails fast)
  routes/             ingest, items, query, conversations, health (thin)
  schemas/            zod request schemas
  services/           ingestion pipeline, extractor, pageFetcher, chunker,
                      embeddings, retrieval, answer, query, conversations
  ai/client.ts        Gemini via the OpenAI SDK, retry policy, error mapping
  db/                 connection, schema, itemsRepo, chunksRepo, conversationsRepo
  domain/             shared item, chunk, answer and conversation types
  lib/                errors, error handler, logging, retry, job queue, timing,
                      vector maths, URL safety, text titles
server/tests/         chunker, vector maths, URL safety, schemas, citations, ranking,
                      AI error mapping, conversations (against an in-memory SQLite database)
client/src/
  api/                typed fetch wrapper and response types
  hooks/              useItems (pending-only polling), useConversations (open chat + history), useAsyncAction
  components/chat/    ChatThread, ChatTurnView, AnswerView, SourceCard, ChatComposer, ChatWelcome, HistorySheet
  components/inbox/   AddContentDialog, IngestForm, SaveProgress, SavedItemsSheet, ItemList, ItemRow,
                      ItemIcon, ItemStatusBadge, ProcessingBar
  components/         AppHeader, Pill (shared status/tag chip)
  lib/                formatting, processing-stage labels, question suggestions, link detection,
                      drawer width
```
