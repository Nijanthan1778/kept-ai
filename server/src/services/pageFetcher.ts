import { IngestionError } from "../lib/errors.js";
import { assertPublicUrl } from "../lib/urlSafety.js";

export const FETCH_TIMEOUT_MS = 10_000;
export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
export const MAX_REDIRECTS = 5;

const USER_AGENT = "KeptAI/1.0 (personal knowledge inbox; fetches pages a user saved)";
const ALLOWED_CONTENT_TYPES = ["text/html", "text/plain"] as const;
type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

export interface FetchedPage {
  /** The URL after redirects; used to resolve relative links during extraction. */
  finalUrl: string;
  contentType: AllowedContentType;
  body: string;
}

function isRedirect(status: number): boolean {
  return status >= 300 && status < 400;
}

function parseContentType(header: string | null): { mediaType: string; charset: string } {
  const [mediaType = "", ...params] = (header ?? "").split(";").map((part) => part.trim());
  const charsetParam = params.find((p) => p.toLowerCase().startsWith("charset="));
  const charset = charsetParam?.slice("charset=".length).replace(/"/g, "") || "utf-8";
  return { mediaType: mediaType.toLowerCase(), charset };
}

function isAllowedContentType(mediaType: string): mediaType is AllowedContentType {
  return (ALLOWED_CONTENT_TYPES as readonly string[]).includes(mediaType);
}

/** Follows redirects by hand so every hop gets the same SSRF check as the original URL. */
async function fetchFollowingSafeRedirects(startUrl: URL, signal: AbortSignal): Promise<Response> {
  let url = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(url);
    const response = await fetch(url, {
      redirect: "manual",
      signal,
      headers: { "User-Agent": USER_AGENT, Accept: "text/html, text/plain;q=0.9" },
    });

    const location = response.headers.get("location");
    if (!isRedirect(response.status) || !location) {
      return response;
    }
    await response.body?.cancel();
    url = new URL(location, url);
  }
  throw new IngestionError(`The page redirected more than ${MAX_REDIRECTS} times`);
}

/** Reads the body as a stream, stopping as soon as it passes the size limit. */
async function readBodyWithLimit(response: Response, charset: string): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (declaredLength > MAX_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new IngestionError("The page is larger than the 5 MB limit");
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  for await (const chunk of response.body ?? []) {
    totalBytes += chunk.byteLength;
    if (totalBytes > MAX_RESPONSE_BYTES) {
      throw new IngestionError("The page is larger than the 5 MB limit");
    }
    chunks.push(chunk);
  }

  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder(charset);
  } catch {
    decoder = new TextDecoder("utf-8"); // unknown charset label: best effort
  }
  return decoder.decode(Buffer.concat(chunks));
}

/** Turns low-level fetch failures into messages a user can act on. */
function toIngestionError(err: unknown, url: URL): IngestionError {
  if (err instanceof IngestionError) return err;
  if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
    return new IngestionError(`The page took longer than ${FETCH_TIMEOUT_MS / 1000} seconds to load`, {
      cause: err,
    });
  }
  return new IngestionError(`Could not connect to ${url.hostname}`, { cause: err });
}

/**
 * Downloads a user-supplied URL safely: public addresses only (re-checked on every redirect),
 * one timeout for the whole download including the body, a 5 MB cap, and HTML or plain text only.
 */
export async function fetchPage(rawUrl: string): Promise<FetchedPage> {
  const url = new URL(rawUrl);
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);

  try {
    const response = await fetchFollowingSafeRedirects(url, signal);

    if (!response.ok) {
      await response.body?.cancel();
      throw new IngestionError(`The page responded with HTTP ${response.status}`);
    }

    const { mediaType, charset } = parseContentType(response.headers.get("content-type"));
    if (!isAllowedContentType(mediaType)) {
      await response.body?.cancel();
      throw new IngestionError(
        `Unsupported content type "${mediaType || "unknown"}". Only HTML pages and plain text can be saved`,
      );
    }

    const body = await readBodyWithLimit(response, charset);
    return { finalUrl: response.url || url.toString(), contentType: mediaType, body };
  } catch (err) {
    throw toIngestionError(err, url);
  }
}
