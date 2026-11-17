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
