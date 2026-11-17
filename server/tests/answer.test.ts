import { describe, expect, it } from "vitest";
import type { ScoredChunk } from "../src/domain/chunk.js";
import { buildMessages, findCitedSourceNumbers, stripFootnoteMarkers } from "../src/services/answer.js";

function chunk(overrides: Partial<ScoredChunk>): ScoredChunk {
  return {
    chunkId: "c",
    itemId: "i",
    content: "text",
    embedding: new Float32Array(),
    title: null,
    sourceType: "note",
    url: null,
    score: 0.9,
    ...overrides,
  };
}

describe("findCitedSourceNumbers", () => {
  it.each([
    ["Milk [1] and eggs [2][3].", [1, 2, 3]],
    ["Both say so [1, 3].", [1, 3]],
    ["Repeated [2] and [2].", [2]],
    ["No citations here.", []],
    ["Out of range [0] and [9] are ignored, [2] is kept.", [2]],
    ["A year like [2020] is not a citation.", []],
  ])("%s → %j", (answer, expected) => {
    expect([...findCitedSourceNumbers(answer, 3)].sort()).toEqual(expected);
  });
});

describe("stripFootnoteMarkers", () => {
  it("removes Wikipedia-style footnotes", () => {
    expect(stripFootnoteMarkers("RAG retrieves documents.[1][23] Coined in 2020.[citation needed]")).toBe(
      "RAG retrieves documents. Coined in 2020.",
    );
  });

  it("keeps other bracketed text", () => {
    expect(stripFootnoteMarkers("See [important] and x[i].")).toBe("See [important] and x[i].");
  });
});

describe("buildMessages", () => {
  it("numbers sources in order and strips footnotes only from web pages", () => {
    const [system, user] = buildMessages("What to buy?", [
      chunk({ title: "Groceries", content: "eggs, arr[0] stays" }),
      chunk({ sourceType: "url", url: "https://wiki.example/x", title: "Wiki", content: "Fact.[12]" }),
    ]);

    expect(system!.content).toMatch(/ONLY the numbered sources/);
    expect(user!.content).toContain("[1] Groceries\neggs, arr[0] stays");
    expect(user!.content).toContain("[2] Wiki | https://wiki.example/x\nFact.");
    expect(user!.content).not.toContain("[12]");
    expect(user!.content).toMatch(/Question: What to buy\?$/);
  });
});
