import { Readability } from "@mozilla/readability";
import { JSDOM, VirtualConsole } from "jsdom";
import { IngestionError } from "../lib/errors.js";
import { fetchPage, type FetchedPage } from "./pageFetcher.js";

/** Below this, the page almost certainly needs JavaScript or a login to show its content. */
export const MIN_EXTRACTED_CHARS = 80;
/**
 * Cap on stored text (~50 chunks). A huge page would otherwise mean hundreds of embedding
 * calls against a rate-limited API for one item.
 */
export const MAX_EXTRACTED_CHARS = 100_000;
const MAX_TITLE_CHARS = 300;

const BLOCK_ELEMENTS =
  "address,article,aside,blockquote,dd,div,dl,dt,figcaption,footer,h1,h2,h3,h4,h5,h6,header,hr,li,main,nav,ol,p,pre,section,table,tr,ul";

export interface ExtractedContent {
  title: string | null;
  text: string;
  truncated: boolean;
}

/** Collapses runs of spaces but keeps paragraph breaks, which the chunker splits on. */
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ") // any whitespace except newlines → one space
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * textContent alone glues blocks together ("Heading</h2><p>Text" → "HeadingText"),
 * so mark the end of every block element with a paragraph break first.
 */
function textWithBlockBreaks(root: Element): string {
  const doc = root.ownerDocument;
  for (const br of root.querySelectorAll("br")) br.replaceWith(doc.createTextNode("\n"));
  for (const el of root.querySelectorAll(BLOCK_ELEMENTS)) el.append(doc.createTextNode("\n\n"));
  return normalizeText(root.textContent ?? "");
}

function cleanTitle(title: string | null | undefined): string | null {
  const cleaned = title?.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, MAX_TITLE_CHARS) : null;
}

function extractFromHtml(page: FetchedPage): { title: string | null; text: string } {
  // jsdom runs no page scripts and loads no sub-resources by default; the silent
  // VirtualConsole hides its CSS parse warnings.
  const dom = new JSDOM(page.body, { url: page.finalUrl, virtualConsole: new VirtualConsole() });
  const document = dom.window.document;
  const pageTitle = document.title;

  try {
    const article = new Readability(document).parse();
    if (article?.content) {
      const container = document.createElement("div");
      container.innerHTML = article.content;
      return { title: cleanTitle(article.title || pageTitle), text: textWithBlockBreaks(container) };
    }
    // Readability found no main article (e.g. a short page): fall back to the whole body.
    return { title: cleanTitle(pageTitle), text: document.body ? textWithBlockBreaks(document.body) : "" };
  } finally {
    dom.window.close();
  }
}

/** Pulls the readable title and text out of a fetched page. */
export function extractContent(page: FetchedPage): ExtractedContent {
  const { title, text } =
    page.contentType === "text/html" ? extractFromHtml(page) : { title: null, text: normalizeText(page.body) };

  if (text.length < MIN_EXTRACTED_CHARS) {
    throw new IngestionError(
      "Couldn't find readable text on this page. It may need JavaScript or a login to show its content",
    );
  }

  const truncated = text.length > MAX_EXTRACTED_CHARS;
  return { title, text: truncated ? text.slice(0, MAX_EXTRACTED_CHARS) : text, truncated };
}

export async function fetchAndExtract(url: string): Promise<ExtractedContent> {
  const page = await fetchPage(url);
  return extractContent(page);
}
