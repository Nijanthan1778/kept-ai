import { Router } from "express";
import type { ItemsRepo } from "../db/itemsRepo.js";
import { NotFoundError } from "../lib/errors.js";
import { parseOrThrow } from "../lib/validate.js";
import { itemIdParamsSchema } from "../schemas/items.js";
import { PREVIEW_MAX_CHARS, toItemDto } from "./itemDto.js";

// Read extra characters so the preview is still full-length after whitespace is collapsed.
const CONTENT_HEAD_CHARS = PREVIEW_MAX_CHARS * 2;

// Plain reads and deletes with no business rules, so the routes talk to the repository directly.
export function createItemsRouter(itemsRepo: ItemsRepo) {
  const router = Router();

  router.get("/items", (_req, res) => {
    const items = itemsRepo
      .listWithContentHead(CONTENT_HEAD_CHARS)
      .map((item) => toItemDto(item, item.contentHead));
    res.json({ items });
  });

  // Removes the item and its chunks. Safe while it is still processing: the pipeline
  // checks the item still exists before storing anything.
  router.delete("/items/:id", (req, res) => {
    const { id } = parseOrThrow(itemIdParamsSchema, req.params);
    if (!itemsRepo.delete(id)) {
      throw new NotFoundError(`Item ${id} does not exist`);
    }
    res.status(204).end();
  });

  return router;
}
