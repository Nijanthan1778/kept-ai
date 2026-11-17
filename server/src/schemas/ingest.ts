import { z } from "zod";
import { NOT_AN_OBJECT_MESSAGE, isPlainObject, nonEmptyText, requiredString } from "./common.js";

export const NOTE_MAX_CHARS = 20_000;
export const URL_MAX_CHARS = 2_048;

const noteRequestSchema = z.object({
  type: z.literal("note"),
  content: nonEmptyText("content", NOTE_MAX_CHARS),
});

const urlRequestSchema = z.object({
  type: z.literal("url"),
  url: requiredString("url")
    .trim()
    .max(URL_MAX_CHARS, `url must be at most ${URL_MAX_CHARS} characters`)
    .pipe(z.url({ protocol: /^https?$/, error: "url must be a valid http:// or https:// URL" })),
});

export const ingestRequestSchema = z.discriminatedUnion("type", [noteRequestSchema, urlRequestSchema], {
  error: (issue) => (isPlainObject(issue.input) ? 'type must be "note" or "url"' : NOT_AN_OBJECT_MESSAGE),
});

export type IngestRequest = z.infer<typeof ingestRequestSchema>;
