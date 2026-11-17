import { Router } from "express";
import type { ItemsRepo } from "../db/itemsRepo.js";
import { PREVIEW_MAX_CHARS, toItemDto } from "./itemDto.js";

// Read extra characters so the preview is still full-length after whitespace is collapsed.
const CONTENT_HEAD_CHARS = PREVIEW_MAX_CHARS * 2;

// A plain read with no business rules, so the route talks to the repository directly.
export function createItemsRouter(itemsRepo: ItemsRepo) {
  const router = Router();

  router.get("/items", (_req, res) => {
    const items = itemsRepo
      .listWithContentHead(CONTENT_HEAD_CHARS)
      .map((item) => toItemDto(item, item.contentHead));
    res.json({ items });
  });

  return router;
}
