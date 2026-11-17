import { Fragment, useState, type ReactNode } from 'react'
import type { QueryResult } from '@/api/types'
import { SourceCard } from '@/components/SourceCard'
import { sourceElementId } from '@/lib/sourceAnchor'

// Same citation format the server parses: [1], [1][2] or [1, 2].
const CITATION_PATTERN = /\[(\d+(?:\s*,\s*\d+)*)\]/g

interface CitationLinkProps {
  number: number
  onHighlight: (number: number | null) => void
}

function CitationLink({ number, onHighlight }: CitationLinkProps) {
  const id = sourceElementId(number)
  return (
    <a
      href={`#${id}`}
      className="mx-0.5 align-super text-xs font-semibold text-primary hover:underline"
      aria-label={`Source ${number}`}
      onMouseEnter={() => onHighlight(number)}
      onMouseLeave={() => onHighlight(null)}
      onFocus={() => onHighlight(number)}
      onBlur={() => onHighlight(null)}
      onClick={(event) => {
        event.preventDefault()
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        onHighlight(number)
      }}
    >
      [{number}]
    </a>
  )
}

/** Turns "[n]" markers that match a real source into links; anything else stays plain text. */
function renderWithCitations(answer: string, sourceCount: number, onHighlight: (n: number | null) => void): ReactNode[] {
  const parts: ReactNode[] = []
  let lastIndex = 0
  for (const match of answer.matchAll(CITATION_PATTERN)) {
    const numbers = match[1]!.split(',').map((n) => Number(n.trim()))
    if (!numbers.every((n) => n >= 1 && n <= sourceCount)) continue
    parts.push(answer.slice(lastIndex, match.index))
    parts.push(
      <Fragment key={match.index}>
        {numbers.map((n) => (
          <CitationLink key={n} number={n} onHighlight={onHighlight} />
        ))}
      </Fragment>,
    )
    lastIndex = match.index + match[0].length
  }
  parts.push(answer.slice(lastIndex))
  return parts
}

export function AnswerView({ result }: { result: QueryResult }) {
  const [highlighted, setHighlighted] = useState<number | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <p className="leading-relaxed whitespace-pre-line">
        {renderWithCitations(result.answer, result.sources.length, setHighlighted)}
      </p>

      {result.sources.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">Sources</h3>
          {result.sources.map((source) => (
            <SourceCard key={source.chunkId} source={source} highlighted={highlighted === source.index} />
          ))}
        </section>
      )}
    </div>
  )
}
