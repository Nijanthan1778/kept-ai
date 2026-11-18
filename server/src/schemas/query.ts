import { z } from "zod";
import { NOT_AN_OBJECT_MESSAGE, nonEmptyText, uuidField } from "./common.js";

export const QUESTION_MAX_CHARS = 1_000;

export const queryRequestSchema = z.object(
  {
    question: nonEmptyText("question", QUESTION_MAX_CHARS),
    /** Continue this conversation; omit to start a new one. */
    conversationId: uuidField("conversationId", "conversation").optional(),
  },
  { error: NOT_AN_OBJECT_MESSAGE },
);

export type QueryRequest = z.infer<typeof queryRequestSchema>;
