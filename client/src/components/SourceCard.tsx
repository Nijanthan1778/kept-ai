import { useState } from 'react'
import { LinkIcon, StickyNoteIcon } from 'lucide-react'
import type { QuerySource } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { hostname } from '@/lib/format'
import { sourceElementId } from '@/lib/sourceAnchor'
import { cn } from '@/lib/utils'

const COLLAPSED_SNIPPET_CHARS = 300

function sourceTitle(source: QuerySource): string {
  if (source.title) return source.title
  if (source.url) return hostname(source.url)
  return 'Untitled note'
}

interface SourceCardProps {
  source: QuerySource
  highlighted: boolean
}

export function SourceCard({ source, highlighted }: SourceCardProps) {
  const [expanded, setExpanded] = useState(false)
  const Icon = source.sourceType === 'url' ? LinkIcon : StickyNoteIcon
  const isLong = source.snippet.length > COLLAPSED_SNIPPET_CHARS

  return (
    <article
      id={sourceElementId(source.index)}
      className={cn(
        'flex scroll-mt-4 flex-col gap-2 rounded-lg border p-3 transition-colors',
        highlighted && 'border-primary bg-muted/60',
        !source.cited && 'opacity-75',
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-sm font-semibold">[{source.index}]</span>
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-label={source.sourceType} />
          <span className="truncate text-sm font-medium">{sourceTitle(source)}</span>
        </div>
        <div className="flex shrink-0 gap-1">
          <Badge variant={source.cited ? 'default' : 'outline'}>{source.cited ? 'Cited' : 'Not cited'}</Badge>
          <Badge variant="secondary" title="Cosine similarity to your question (higher is closer)">
            {source.score.toFixed(2)}
          </Badge>
        </div>
      </header>

      {source.url && (
        <a href={source.url} target="_blank" rel="noreferrer" className="truncate text-xs text-muted-foreground hover:underline">
          {source.url}
        </a>
      )}

      <p className={cn('text-sm whitespace-pre-line text-muted-foreground', !expanded && 'line-clamp-4')}>{source.snippet}</p>
      {isLong && (
        <Button variant="link" size="sm" className="h-auto self-start p-0" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show less' : 'Show more'}
        </Button>
      )}
    </article>
  )
}
