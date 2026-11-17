import { z } from "zod";

export const NOT_AN_OBJECT_MESSAGE = "Request body must be a JSON object";

export function isPlainObject(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** "is required" when the field is missing, "must be a string" when it has the wrong type. */
export function requiredString(field: string) {
  return z.string({
    error: (issue) => (issue.input === undefined ? `${field} is required` : `${field} must be a string`),
  });
}

/** A required string, trimmed, that must be non-empty and at most `maxChars` long. */
export function nonEmptyText(field: string, maxChars: number) {
  return requiredString(field)
    .trim()
    .min(1, `${field} cannot be empty`)
    .max(maxChars, `${field} must be at most ${maxChars.toLocaleString("en-US")} characters`);
}
