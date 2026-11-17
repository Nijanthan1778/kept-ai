import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

const SERVER_ROOT = path.resolve(import.meta.dirname, "..");
const ENV_FILE = path.join(SERVER_ROOT, ".env");

// Node's built-in .env loader; real environment variables still take precedence.
if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

const MISSING_KEY_MESSAGE = "is required. Get a key from Google AI Studio and set it in server/.env";

const envSchema = z.object({
  AI_API_KEY: z.string({ error: MISSING_KEY_MESSAGE }).trim().min(1, MISSING_KEY_MESSAGE),
  AI_BASE_URL: z.url().default("https://generativelanguage.googleapis.com/v1beta/openai/"),
  EMBEDDING_MODEL: z.string().min(1).default("gemini-embedding-001"),
  // gemini-2.5-flash is deprecated (shutdown 2026-12-01); this is Google's listed replacement.
  CHAT_MODEL: z.string().min(1).default("gemini-3.5-flash-lite"),
  PORT: z.coerce.number().int().positive().default(4000),
  TOP_K: z.coerce.number().int().min(1).max(20).default(5),
  MIN_SIMILARITY: z.coerce.number().min(-1).max(1).default(0.3),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DB_PATH: z.string().min(1).default(path.join(SERVER_ROOT, "data", "kept.db")),
});

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // Fail fast: the logger isn't configured yet, so write straight to stderr.
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    console.error(`Invalid environment configuration:\n${problems.join("\n")}`);
    process.exit(1);
  }

  const env = parsed.data;
  return {
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    dbPath: env.DB_PATH,
    ai: {
      apiKey: env.AI_API_KEY,
      baseUrl: env.AI_BASE_URL,
      embeddingModel: env.EMBEDDING_MODEL,
      chatModel: env.CHAT_MODEL,
    },
    retrieval: {
      topK: env.TOP_K,
      minSimilarity: env.MIN_SIMILARITY,
    },
  } as const;
}

export const config = loadConfig();
export type Config = typeof config;
