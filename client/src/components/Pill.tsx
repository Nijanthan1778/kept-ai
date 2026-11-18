import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type PillTone = 'green' | 'amber' | 'red' | 'indigo' | 'sky' | 'gray'

const TONES: Record<PillTone, string> = {
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700',
  indigo: 'bg-indigo-50 text-indigo-700',
  sky: 'bg-sky-50 text-sky-700',
  gray: 'bg-muted text-muted-foreground',
}

const DOTS: Record<PillTone, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  indigo: 'bg-indigo-500',
  sky: 'bg-sky-500',
  gray: 'bg-muted-foreground',
}

interface PillProps {
  tone: PillTone
  children: ReactNode
  /** Leading coloured dot, as in the header's status summary. */
  dot?: boolean
  className?: string
}

/** A small rounded label used for statuses, counts, source types and match scores. */
export function Pill({ tone, children, dot, className }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap [&>svg]:size-3.5',
        TONES[tone],
        className,
      )}
    >
      {dot && <span className={cn('size-2 rounded-full', DOTS[tone])} aria-hidden />}
      {children}
    </span>
  )
}
