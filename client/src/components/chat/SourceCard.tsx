import { useState } from 'react'
import type { QuerySource } from '@/api/types'
import { Pill } from '@/components/Pill'
import { Button } from '@/components/ui/button'
import { hostname } from '@/lib/format'
import { sourceElementId } from '@/lib/sourceAnchor'
import { cn } from '@/lib/utils'

const COLLAPSED_SNIPPET_CHARS = 280

function sourceTitle(source: QuerySource): string {
  if (source.title) return source.title
  if (source.url) return hostname(source.url)
  return 'Untitled note'
}

interface SourceCardProps {
  /** The chat turn this source belongs to; makes the card's anchor id unique in the thread. */
  turnId: string
  source: QuerySource
  highlighted: boolean
}

export function SourceCard({ turnId, source, highlighted }: SourceCardProps) {
  const [expanded, setExpanded] = useState(false)
  const isLong = source.snippet.length > COLLAPSED_SNIPPET_CHARS
  const score = source.score.toFixed(2)

  return (
    <article
      id={sourceElementId(turnId, source.index)}
      className={cn(
        'flex scroll-mt-4 flex-col gap-2 rounded-xl border bg-card p-4 transition-colors',
        !source.cited && 'border-dashed bg-transparent',
        highlighted && 'border-primary bg-indigo-50/60',
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              'flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold',
              source.cited ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}
          >
            {source.index}
          </span>
          <span className="truncate font-semibold">{sourceTitle(source)}</span>
          <Pill tone={source.sourceType === 'url' ? 'sky' : 'indigo'}>{source.sourceType === 'url' ? 'URL' : 'Note'}</Pill>
        </div>
        {source.cited ? (
          <Pill tone="green" className="text-sm">
            Match {score}
          </Pill>
        ) : (
          <Pill tone="gray" className="text-sm">
            Retrieved, not cited · {score}
          </Pill>
        )}
      </header>

      <p className={cn('text-sm whitespace-pre-line text-muted-foreground', !expanded && 'line-clamp-3')}>
        {source.snippet}
      </p>
      {isLong && (
        <Button variant="link" size="sm" className="h-auto self-start p-0" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show less' : 'Show more'}
        </Button>
      )}
    </article>
  )
}
