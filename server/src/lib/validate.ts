import type { z } from "zod";
import { ValidationError } from "./errors.js";

export interface FieldIssue {
  field: string;
  message: string;
}

function toFieldIssues(error: z.ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : "body",
    message: issue.message,
  }));
}

/** Parses untrusted input, or throws a 400 ValidationError listing every invalid field. */
export function parseOrThrow<Schema extends z.ZodType>(schema: Schema, input: unknown): z.infer<Schema> {
  const result = schema.safeParse(input);
  if (result.success) {
    return result.data;
  }
  const issues = toFieldIssues(result.error);
  const summary = issues.map((i) => i.message).join("; ");
  throw new ValidationError(`Invalid request: ${summary}`, issues);
}
