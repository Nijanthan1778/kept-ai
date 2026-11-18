/**
 * True when the text is nothing but a single http(s) link, e.g. a URL pasted into the Note tab
 * or a note whose title is just a link. Text that merely contains a link ("Read later: https://…")
 * is a real note and returns false.
 */
export function isBareUrl(text: string): boolean {
  const trimmed = text.trim()
  if (!/^https?:\/\/\S+$/i.test(trimmed)) return false
  try {
    new URL(trimmed)
    return true
  } catch {
    return false
  }
}
