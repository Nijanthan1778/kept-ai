import type { Item, ItemStatus, SourceType } from "../domain/item.js";

export const PREVIEW_MAX_CHARS = 200;

/** The public shape of an item in API responses. Full content is never sent, only a preview. */
export interface ItemDto {
  id: string;
  sourceType: SourceType;
  url: string | null;
  title: string | null;
  status: ItemStatus;
  errorMessage: string | null;
  createdAt: string;
  preview: string | null;
}

/** Collapses whitespace and cuts to PREVIEW_MAX_CHARS, adding an ellipsis when shortened. */
export function makePreview(content: string | null): string | null {
  if (!content) return null;
  const flattened = content.replace(/\s+/g, " ").trim();
  return flattened.length > PREVIEW_MAX_CHARS
    ? `${flattened.slice(0, PREVIEW_MAX_CHARS).trimEnd()}…`
    : flattened;
}

export function toItemDto(item: Item, content: string | null): ItemDto {
  return {
    id: item.id,
    sourceType: item.sourceType,
    url: item.url,
    title: item.title,
    status: item.status,
    errorMessage: item.errorMessage,
    createdAt: item.createdAt,
    preview: makePreview(content),
  };
}
