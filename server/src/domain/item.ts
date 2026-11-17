export type SourceType = "note" | "url";
export type ItemStatus = "pending" | "ready" | "failed";

/** An item's metadata, without its (possibly large) raw content. */
export interface Item {
  id: string;
  sourceType: SourceType;
  url: string | null;
  title: string | null;
  status: ItemStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ItemWithContent extends Item {
  /** Null for a URL item until its page has been fetched. */
  rawContent: string | null;
}

/** Row shape for list views: metadata plus only the first few hundred characters of content. */
export interface ItemWithContentHead extends Item {
  contentHead: string | null;
}
