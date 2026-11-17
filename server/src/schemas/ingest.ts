import { z } from "zod";

export const NOTE_MAX_CHARS = 20_000;
export const URL_MAX_CHARS = 2_048;

function isPlainObject(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** "is required" when the field is missing, "must be a string" when it has the wrong type. */
function requiredString(field: string) {
  return z.string({
    error: (issue) => (issue.input === undefined ? `${field} is required` : `${field} must be a string`),
  });
}

const noteRequestSchema = z.object({
  type: z.literal("note"),
  content: requiredString("content")
    .trim()
    .min(1, "content cannot be empty")
    .max(NOTE_MAX_CHARS, `content must be at most ${NOTE_MAX_CHARS.toLocaleString("en-US")} characters`),
});

const urlRequestSchema = z.object({
  type: z.literal("url"),
  url: requiredString("url")
    .trim()
    .max(URL_MAX_CHARS, `url must be at most ${URL_MAX_CHARS} characters`)
    .pipe(z.url({ protocol: /^https?$/, error: "url must be a valid http:// or https:// URL" })),
});

export const ingestRequestSchema = z.discriminatedUnion("type", [noteRequestSchema, urlRequestSchema], {
  error: (issue) =>
    isPlainObject(issue.input) ? 'type must be "note" or "url"' : "Request body must be a JSON object",
});

export type IngestRequest = z.infer<typeof ingestRequestSchema>;
