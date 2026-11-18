/**
 * A short title from free text: its first non-empty line with whitespace collapsed, cut to
 * `maxChars` with an ellipsis. Used for note titles and conversation titles.
 */
export function firstLineTitle(text: string, maxChars: number): string {
  const firstLine =
    text
      .split("\n")
      .find((line) => line.trim().length > 0)
      ?.replace(/\s+/g, " ")
      .trim() ?? "";
  return firstLine.length > maxChars ? `${firstLine.slice(0, maxChars - 1).trimEnd()}…` : firstLine;
}
