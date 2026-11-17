import { z } from "zod";
import { NOT_AN_OBJECT_MESSAGE, nonEmptyText } from "./common.js";

export const QUESTION_MAX_CHARS = 1_000;

export const queryRequestSchema = z.object(
  { question: nonEmptyText("question", QUESTION_MAX_CHARS) },
  { error: NOT_AN_OBJECT_MESSAGE },
);

export type QueryRequest = z.infer<typeof queryRequestSchema>;
