import { describe, expect, it } from "vitest";
import { CHUNK_OVERLAP, CHUNK_SIZE, chunkText, type TextChunk } from "../src/services/chunker.js";

function paragraphs(count: number, wordsEach = 40): string {
  return Array.from({ length: count }, (_, i) => `Paragraph ${i}: ${"lorem ipsum ".repeat(wordsEach / 2).trim()}.`).join(
    "\n\n",
  );
}

function expectOffsetsMatch(text: string, chunks: TextChunk[]) {
  for (const chunk of chunks) {
    expect(text.slice(chunk.startOffset, chunk.endOffset)).toBe(chunk.content);
  }
}

describe("chunkText", () => {
  it("returns no chunks for empty or whitespace-only text", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("  \n\n  ")).toEqual([]);
  });

  it("keeps a short note as a single chunk", () => {
    const note = "Buy milk.\n\nCall the dentist on Monday.";
    expect(chunkText(note)).toEqual([{ index: 0, content: note, startOffset: 0, endOffset: note.length }]);
  });

  it("splits long text into chunks no larger than CHUNK_SIZE, with correct offsets", () => {
    const text = paragraphs(40);
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i));
    for (const chunk of chunks) expect(chunk.content.length).toBeLessThanOrEqual(CHUNK_SIZE);
    expectOffsetsMatch(text, chunks);
  });

  it("overlaps consecutive chunks when paragraphs are short", () => {
    const chunks = chunkText(paragraphs(40));
    for (let i = 1; i < chunks.length; i++) {
      const overlap = chunks[i - 1]!.endOffset - chunks[i]!.startOffset;
      expect(overlap).toBeGreaterThan(0);
      expect(overlap).toBeLessThanOrEqual(CHUNK_OVERLAP);
    }
  });

  it("covers the whole text: nothing is lost between chunks", () => {
    const text = paragraphs(40);
    const chunks = chunkText(text);
    expect(chunks[0]!.startOffset).toBe(0);
    expect(chunks.at(-1)!.endOffset).toBe(text.length);
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i]!.startOffset).toBeLessThanOrEqual(chunks[i - 1]!.endOffset);
    }
  });

  it("respects paragraph boundaries: every chunk ends at the end of a paragraph", () => {
    const text = paragraphs(40);
    for (const chunk of chunkText(text)) {
      const atEnd = chunk.endOffset === text.length;
      expect(atEnd || text.startsWith("\n\n", chunk.endOffset)).toBe(true);
    }
  });

  it("falls back to sentence boundaries for one long paragraph", () => {
    const text = Array.from({ length: 150 }, (_, i) => `Sentence ${i} ends here.`).join(" ");
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks.slice(0, -1)) expect(chunk.content.endsWith(".")).toBe(true);
    expectOffsetsMatch(text, chunks);
  });

  it("hard-cuts a single unbroken run longer than CHUNK_SIZE", () => {
    const text = "x".repeat(CHUNK_SIZE * 2 + 500);
    const chunks = chunkText(text);
    expect(chunks.map((c) => c.content.length)).toEqual([CHUNK_SIZE, CHUNK_SIZE, 500]);
  });
});
