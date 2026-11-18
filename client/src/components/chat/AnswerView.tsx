import { useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { ChevronDownIcon } from 'lucide-react'
import type { QueryResult } from '@/api/types'
import { SourceCard } from '@/components/chat/SourceCard'
import { sourceElementId } from '@/lib/sourceAnchor'
import { cn } from '@/lib/utils'

// Same citation format the server parses: [1], [1][2] or [1, 2].
const CITATION_PATTERN = /\[(\d+(?:\s*,\s*\d+)*)\]/g

interface CitationHandlers {
  onHighlight: (number: number | null) => void
  onOpen: (number: number) => void
}

function CitationPill({ number, onHighlight, onOpen }: { number: number } & CitationHandlers) {
  return (
    <button
      type="button"
      aria-label={`Show source ${number}`}
      className="ml-1 inline-flex h-5 min-w-6 items-center justify-center rounded-md bg-primary px-2 align-[0.1em] text-xs font-semibold text-primary-foreground hover:bg-primary/85"
      onMouseEnter={() => onHighlight(number)}
      onMouseLeave={() => onHighlight(null)}
      onFocus={() => onHighlight(number)}
      onBlur={() => onHighlight(null)}
      onClick={() => onOpen(number)}
    >
      {number}
    </button>
  )
}

/** Splits "…owns the onboarding flow " into ["…owns the onboarding ", "flow"]. */
function splitLastWord(text: string): [string, string] {
  const match = /(\S+)\s*$/.exec(text)
  return match ? [text.slice(0, match.index), match[1]!] : [text, '']
}

/**
 * Turns "[n]" markers that match a real source into pills; anything else stays plain text.
 * Each pill is kept on the same line as the word before it, so it never wraps onto a line alone.
 */
function renderWithCitations(text: string, sourceCount: number, handlers: CitationHandlers): ReactNode[] {
  const parts: ReactNode[] = []
  let lastIndex = 0
  for (const match of text.matchAll(CITATION_PATTERN)) {
    const numbers = match[1]!.split(',').map((n) => Number(n.trim()))
    if (!numbers.every((n) => n >= 1 && n <= sourceCount)) continue
    const [before, lastWord] = splitLastWord(text.slice(lastIndex, match.index))
    parts.push(before)
    parts.push(
      <span key={match.index} className="whitespace-nowrap">
        {lastWord}
        {numbers.map((n) => (
          <CitationPill key={n} number={n} {...handlers} />
        ))}
      </span>,
    )
    lastIndex = match.index + match[0].length
  }
  parts.push(text.slice(lastIndex))
  return parts
}

interface AnswerViewProps {
  turnId: string
  result: QueryResult
}

/**
 * One answer in the chat thread. Sources start collapsed so the conversation stays readable;
 * clicking a citation pill opens them and scrolls to the cited card.
 */
export function AnswerView({ turnId, result }: AnswerViewProps) {
  const [highlighted, setHighlighted] = useState<number | null>(null)
  const [showSources, setShowSources] = useState(false)
  const citedCount = result.sources.filter((source) => source.cited).length
  const paragraphs = result.answer.split(/\n\s*\n/).filter((p) => p.trim().length > 0)

  function openSource(number: number) {
    // Render the cards first (synchronously), so the target exists before we scroll to it.
    flushSync(() => setShowSources(true))
    document.getElementById(sourceElementId(turnId, number))?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    setHighlighted(number)
  }

  const handlers: CitationHandlers = { onHighlight: setHighlighted, onOpen: openSource }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 text-sm leading-relaxed">
        {paragraphs.map((paragraph, i) => (
          <p key={i} className="whitespace-pre-line">
            {renderWithCitations(paragraph, result.sources.length, handlers)}
          </p>
        ))}
      </div>

      {result.sources.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <span>
              Based on {citedCount} of {result.sources.length} sources
            </span>
            <span aria-hidden>·</span>
            <button
              type="button"
              aria-expanded={showSources}
              onClick={() => setShowSources((open) => !open)}
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              {showSources ? 'Hide sources' : 'Show sources'}
              <ChevronDownIcon className={cn('size-4 transition-transform', showSources && 'rotate-180')} aria-hidden />
            </button>
          </div>

          {showSources && (
            <section className="flex flex-col gap-2" aria-label="Sources">
              {result.sources.map((source) => (
                <SourceCard key={source.chunkId} turnId={turnId} source={source} highlighted={highlighted === source.index} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}
