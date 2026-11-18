import OpenAI from "openai";
import { describe, expect, it } from "vitest";
import { aiRetryPolicy, toUpstreamError } from "../src/ai/client.js";

const apiError = (status: number, message: string) =>
  new OpenAI.APIError(status, { message }, message, new Headers());

describe("toUpstreamError", () => {
  it.each([
    // Gemini rejects an invalid key with 400, not 401.
    [400, "Please pass a valid API key", /rejected the API key/],
    [400, "API key not valid. Please pass a valid API key.", /rejected the API key/],
    [401, "Unauthorized", /rejected the API key/],
    [403, "Forbidden", /rejected the API key/],
    [404, "models/xyz is not found", /model was not found/],
    [429, "Resource has been exhausted", /rate limit/],
    [500, "Internal error", /temporarily unavailable/],
    [400, "Invalid argument: contents", /temporarily unavailable/],
  ])("maps %i %j to a clear message", (status, message, expected) => {
    const mapped = toUpstreamError(apiError(status, message));
    expect(mapped.status).toBe(502);
    expect(mapped.message).toMatch(expected);
  });

  it("explains network failures and timeouts", () => {
    expect(toUpstreamError(new OpenAI.APIConnectionTimeoutError()).message).toMatch(/too long/);
    expect(toUpstreamError(new OpenAI.APIConnectionError({ message: "ECONNRESET" })).message).toMatch(/Could not reach/);
  });
});

describe("aiRetryPolicy", () => {
  it("retries rate limits, server errors and network failures, but not bad requests or bad keys", () => {
    expect(aiRetryPolicy.isRetryable(apiError(429, "slow down"))).toBe(true);
    expect(aiRetryPolicy.isRetryable(apiError(503, "unavailable"))).toBe(true);
    expect(aiRetryPolicy.isRetryable(new OpenAI.APIConnectionError({ message: "reset" }))).toBe(true);
    expect(aiRetryPolicy.isRetryable(apiError(400, "Please pass a valid API key"))).toBe(false);
    expect(aiRetryPolicy.isRetryable(apiError(401, "Unauthorized"))).toBe(false);
  });
});
