import OpenAI from "openai";
import { UpstreamError } from "../lib/errors.js";
import type { RetryPolicy } from "../lib/retry.js";

const AI_REQUEST_TIMEOUT_MS = 30_000;

export type AiClient = OpenAI;

/**
 * One OpenAI-SDK client pointed at Gemini's OpenAI-compatible endpoint, so switching
 * provider is a config change (AI_BASE_URL + model names), not a code change.
 */
export function createAiClient(options: { apiKey: string; baseUrl: string }): AiClient {
  return new OpenAI({
    apiKey: options.apiKey,
    baseURL: options.baseUrl,
    timeout: AI_REQUEST_TIMEOUT_MS,
    // Retries are done by withRetry (aiRetryPolicy) instead: they get logged, and the longer
    // backoff suits per-minute rate limits on the free tier better than the SDK's 0.5s/1s.
    maxRetries: 0,
  });
}

function isRetryableAiError(err: unknown): boolean {
  if (err instanceof OpenAI.APIConnectionError) return true; // network failure or timeout
  if (err instanceof OpenAI.APIError) {
    return err.status === 408 || err.status === 429 || (err.status ?? 0) >= 500;
  }
  return false;
}

function retryAfterMs(err: unknown): number | undefined {
  if (!(err instanceof OpenAI.APIError)) return undefined;
  const seconds = Number(err.headers?.get("retry-after"));
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined;
}

/** 3 attempts with 2s then 4s waits on rate limits, server errors and network failures. */
export const aiRetryPolicy: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 2_000,
  maxDelayMs: 30_000,
  isRetryable: isRetryableAiError,
  retryAfterMs,
};

/** Maps an SDK error to a message that tells the user (or operator) what to do about it. */
export function toUpstreamError(err: unknown): UpstreamError {
  if (err instanceof OpenAI.APIConnectionTimeoutError) {
    return new UpstreamError("The AI service took too long to respond. Please try again.", { cause: err });
  }
  if (err instanceof OpenAI.APIConnectionError) {
    return new UpstreamError("Could not reach the AI service. Check your network connection.", { cause: err });
  }
  if (err instanceof OpenAI.APIError) {
    // Gemini answers a bad key with 400 "Please pass a valid API key" (OpenAI would send 401).
    if (err.status === 400 && /api key/i.test(err.message)) {
      return new UpstreamError("The AI service rejected the API key. Check AI_API_KEY.", { cause: err });
    }
    switch (err.status) {
      case 401:
      case 403:
        return new UpstreamError("The AI service rejected the API key. Check AI_API_KEY.", { cause: err });
      case 404:
        return new UpstreamError("The configured AI model was not found. Check the model names in .env.", {
          cause: err,
        });
      case 429:
        return new UpstreamError("The AI service rate limit was reached. Please wait a minute and try again.", {
          cause: err,
        });
    }
  }
  return new UpstreamError("The AI service is temporarily unavailable. Please try again.", { cause: err });
}
