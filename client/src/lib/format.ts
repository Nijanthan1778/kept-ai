const relativeTime = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

/** "just now", "5 minutes ago", "yesterday", and so on. */
export function formatRelativeTime(isoDate: string, now = Date.now()): string {
  const secondsAgo = Math.round((now - new Date(isoDate).getTime()) / 1000)
  for (const [unit, seconds] of UNITS) {
    if (secondsAgo >= seconds) return relativeTime.format(-Math.floor(secondsAgo / seconds), unit)
  }
  return 'just now'
}

/** The host of a URL ("en.wikipedia.org"), or the URL itself if it can't be parsed. */
export function hostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

/** An item's display name: its title, else the URL's host, else a placeholder for untitled notes. */
export function itemTitle(item: { title: string | null; url: string | null }): string {
  if (item.title) return item.title
  if (item.url) return hostname(item.url)
  return 'Untitled note'
}

/** A URL without its scheme and "www.", for compact display ("paulgraham.com/greatwork.html"). */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
}
