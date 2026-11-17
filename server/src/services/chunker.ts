/**
 * Chunking strategy: recursive splitting on natural boundaries, then greedy packing with overlap.
 *
 * - CHUNK_SIZE ≈ 2,000 chars ≈ 500 tokens. Small enough that a chunk is about one idea (precise
 *   retrieval and short snippets), big enough to carry the context needed to answer from it.
 *   It also sits well under the embedding model's 2,048-token input limit.
 * - Splits prefer paragraph breaks, then line breaks, then sentence ends, then spaces, so a chunk
 *   rarely cuts through an idea. Only a single unbroken run longer than CHUNK_SIZE is hard-cut.
 * - CHUNK_OVERLAP ≈ 300 chars repeats the end of one chunk at the start of the next, so a fact
 *   that straddles a boundary is still retrievable from one chunk. Overlap is built from whole
 *   pieces (paragraphs/sentences), so after a paragraph longer than CHUNK_OVERLAP there is none:
 *   the boundary already falls between paragraphs, which is the safest place to cut.
 * - Short notes (≤ CHUNK_SIZE) stay a single chunk.
 */
export const CHUNK_SIZE = 2_000;
export const CHUNK_OVERLAP = 300;

/** Boundaries to split on, strongest first. Each match stays attached to the text before it. */
const SEPARATORS: readonly RegExp[] = [
  /\n\s*\n/g, // paragraph break
  /\n/g, // line break
  /(?<=[.!?])\s+/g, // sentence end
  /\s+/g, // word boundary
];

export interface TextChunk {
  index: number;
  content: string;
  /** Offsets into the original text, so a chunk can be traced back to its source. */
  startOffset: number;
  endOffset: number;
}

interface Span {
  start: number;
  end: number;
}

const spanLength = (span: Span) => span.end - span.start;

/** Splits text[start, end) at every match of `separator`. Spans are contiguous and cover the range. */
function splitAt(text: string, { start, end }: Span, separator: RegExp): Span[] {
  const spans: Span[] = [];
  const pattern = new RegExp(separator.source, "g");
  let pieceStart = start;
  for (const match of text.slice(start, end).matchAll(pattern)) {
    const pieceEnd = start + match.index + match[0].length;
    if (pieceEnd > pieceStart) spans.push({ start: pieceStart, end: pieceEnd });
    pieceStart = pieceEnd;
  }
  if (pieceStart < end) spans.push({ start: pieceStart, end });
  return spans;
}

function hardCut({ start, end }: Span): Span[] {
  const spans: Span[] = [];
  for (let s = start; s < end; s += CHUNK_SIZE) {
    spans.push({ start: s, end: Math.min(s + CHUNK_SIZE, end) });
  }
  return spans;
}

/** Breaks a span into pieces of at most CHUNK_SIZE, using the strongest separator that works. */
function splitIntoPieces(text: string, span: Span, separatorLevel = 0): Span[] {
  if (spanLength(span) <= CHUNK_SIZE) return [span];

  const separator = SEPARATORS[separatorLevel];
  if (!separator) return hardCut(span);

  const parts = splitAt(text, span, separator);
  if (parts.length === 1) return splitIntoPieces(text, span, separatorLevel + 1);
  return parts.flatMap((part) => splitIntoPieces(text, part, separatorLevel + 1));
}

/** Packs consecutive pieces into chunks of up to CHUNK_SIZE, carrying ~CHUNK_OVERLAP chars forward. */
function packWithOverlap(pieces: Span[]): Span[] {
  const chunks: Span[] = [];
  let current: Span[] = [];
  const currentLength = () => (current.length ? current.at(-1)!.end - current[0]!.start : 0);

  for (const piece of pieces) {
    if (current.length > 0 && currentLength() + spanLength(piece) > CHUNK_SIZE) {
      chunks.push({ start: current[0]!.start, end: current.at(-1)!.end });
      // Keep the trailing pieces that fit in the overlap budget and still leave room for `piece`.
      while (
        current.length > 0 &&
        (currentLength() > CHUNK_OVERLAP || currentLength() + spanLength(piece) > CHUNK_SIZE)
      ) {
        current.shift();
      }
    }
    current.push(piece);
  }
  if (current.length > 0) chunks.push({ start: current[0]!.start, end: current.at(-1)!.end });
  return chunks;
}

/** Shrinks a span to exclude leading and trailing whitespace. */
function trimSpan(text: string, { start, end }: Span): Span {
  while (start < end && /\s/.test(text[start]!)) start++;
  while (end > start && /\s/.test(text[end - 1]!)) end--;
  return { start, end };
}

export function chunkText(text: string): TextChunk[] {
  const pieces = splitIntoPieces(text, { start: 0, end: text.length });
  return packWithOverlap(pieces)
    .map((span) => trimSpan(text, span))
    .filter((span) => spanLength(span) > 0)
    .map((span, index) => ({
      index,
      content: text.slice(span.start, span.end),
      startOffset: span.start,
      endOffset: span.end,
    }));
}
