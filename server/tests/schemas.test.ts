import { describe, expect, it } from "vitest";
import { ValidationError } from "../src/lib/errors.js";
import { parseOrThrow } from "../src/lib/validate.js";
import { NOTE_MAX_CHARS, ingestRequestSchema } from "../src/schemas/ingest.js";
import { QUESTION_MAX_CHARS, queryRequestSchema } from "../src/schemas/query.js";

/** The `details` of the ValidationError thrown for `input`. */
function issuesFor(schema: Parameters<typeof parseOrThrow>[0], input: unknown) {
  try {
    parseOrThrow(schema, input);
  } catch (err) {
    expect(err).toBeInstanceOf(ValidationError);
    return (err as ValidationError).details;
  }
  throw new Error("expected validation to fail");
}

describe("ingest request schema", () => {
  it("accepts a note and trims it", () => {
    expect(parseOrThrow(ingestRequestSchema, { type: "note", content: "  hello  " })).toEqual({
      type: "note",
      content: "hello",
    });
  });

  it("accepts an http(s) URL and trims it", () => {
    expect(parseOrThrow(ingestRequestSchema, { type: "url", url: " https://example.com/a " })).toEqual({
      type: "url",
      url: "https://example.com/a",
    });
  });

  it("drops unknown fields", () => {
    expect(parseOrThrow(ingestRequestSchema, { type: "note", content: "x", admin: true })).toEqual({
      type: "note",
      content: "x",
    });
  });

  it.each([
    [undefined, "body", "Request body must be a JSON object"],
    [[1, 2], "body", "Request body must be a JSON object"],
    [{}, "type", 'type must be "note" or "url"'],
    [{ type: "pdf" }, "type", 'type must be "note" or "url"'],
    [{ type: "note" }, "content", "content is required"],
    [{ type: "note", content: 42 }, "content", "content must be a string"],
    [{ type: "note", content: "   " }, "content", "content cannot be empty"],
    [{ type: "note", content: "x".repeat(NOTE_MAX_CHARS + 1) }, "content", "content must be at most 20,000 characters"],
    [{ type: "url" }, "url", "url is required"],
    [{ type: "url", url: "not a url" }, "url", "url must be a valid http:// or https:// URL"],
    [{ type: "url", url: "ftp://example.com" }, "url", "url must be a valid http:// or https:// URL"],
  ])("rejects %j with a field-level message", (input, field, message) => {
    expect(issuesFor(ingestRequestSchema, input)).toEqual([{ field, message }]);
  });
});

describe("query request schema", () => {
  it("accepts and trims a question", () => {
    expect(parseOrThrow(queryRequestSchema, { question: "  What is RAG?  " })).toEqual({ question: "What is RAG?" });
  });

  it.each([
    ["not an object", "body", "Request body must be a JSON object"],
    [{}, "question", "question is required"],
    [{ question: "   " }, "question", "question cannot be empty"],
    [{ question: "q".repeat(QUESTION_MAX_CHARS + 1) }, "question", "question must be at most 1,000 characters"],
  ])("rejects %j with a field-level message", (input, field, message) => {
    expect(issuesFor(queryRequestSchema, input)).toEqual([{ field, message }]);
  });

  it("puts the problems in the error message too", () => {
    expect(() => parseOrThrow(queryRequestSchema, {})).toThrow("Invalid request: question is required");
  });
});
