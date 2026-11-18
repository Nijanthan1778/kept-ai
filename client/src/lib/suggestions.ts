import type { Item } from '@/api/types'
import { isBareUrl } from '@/lib/bareUrl'

const MAX_TITLE_SUGGESTIONS = 2
const MAX_TITLE_CHARS = 40

function shorten(title: string): string {
  return title.length > MAX_TITLE_CHARS ? `${title.slice(0, MAX_TITLE_CHARS - 1).trimEnd()}…` : title
}

/**
 * Example questions built from what is actually saved, so every suggestion can be answered.
 * Uses the newest ready items' titles, plus a summary prompt when links are saved.
 * Items titled with a bare link are skipped: a note that is only a URL has no content to
 * summarise, so a suggestion like `Summarise "https://…"` could never get a useful answer.
 */
export function buildSuggestions(items: Item[]): string[] {
  const ready = items.filter((item) => item.status === 'ready' && item.title && !isBareUrl(item.title))
  const fromTitles = ready
    .slice(0, MAX_TITLE_SUGGESTIONS)
    .map((item) => (item.sourceType === 'url' ? `What are the key points of "${shorten(item.title!)}"?` : `Summarise "${shorten(item.title!)}"`))
  const hasLinks = ready.some((item) => item.sourceType === 'url')
  return hasLinks ? [...fromTitles, 'Summarise my saved links'] : fromTitles
}
