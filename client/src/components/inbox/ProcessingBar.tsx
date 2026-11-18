import type { Item } from '@/api/types'
import { processingLabel, processingProgress } from '@/lib/processing'
import { cn } from '@/lib/utils'

/** Amber progress bar for a pending item, filled according to its current processing stage. */
export function ProcessingBar({ item, className }: { item: Item; className?: string }) {
  const percent = Math.round(processingProgress(item) * 100)
  return (
    <div
      className={cn('h-1.5 overflow-hidden rounded-full bg-amber-100', className)}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={processingLabel(item)}
    >
      <div className="h-full rounded-full bg-amber-500 transition-[width] duration-500" style={{ width: `${percent}%` }} />
    </div>
  )
}
