import { HistoryIcon, InboxIcon, LayersIcon, PlusIcon, SquarePenIcon } from 'lucide-react'
import type { Item, ItemStatus } from '@/api/types'
import { Pill, type PillTone } from '@/components/Pill'
import { Button } from '@/components/ui/button'

const SUMMARY: Array<{ status: ItemStatus; label: string; tone: PillTone }> = [
  { status: 'ready', label: 'ready', tone: 'green' },
  { status: 'pending', label: 'processing', tone: 'amber' },
  { status: 'failed', label: 'failed', tone: 'red' },
]

/** Counts per status; a status with no items is left out. */
function StatusSummary({ items }: { items: Item[] }) {
  return (
    <div className="hidden flex-wrap justify-end gap-2 md:flex" aria-label="Item status summary">
      {SUMMARY.map(({ status, label, tone }) => {
        const count = items.filter((item) => item.status === status).length
        return count > 0 ? (
          <Pill key={status} tone={tone} dot>
            {count} {label}
          </Pill>
        ) : null
      })}
    </div>
  )
}

/** Header buttons are slightly smaller on phones. */
const COMPACT = 'max-sm:h-8 max-sm:px-2'

interface AppHeaderProps {
  items: Item[]
  onOpenHistory: () => void
  onOpenItems: () => void
  onOpenAdd: () => void
  /** Shown only when there is a conversation to leave. */
  onNewChat?: () => void
}

export function AppHeader({ items, onOpenHistory, onOpenItems, onOpenAdd, onNewChat }: AppHeaderProps) {
  return (
    <header className="shrink-0 border-b bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <LayersIcon className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg leading-tight font-semibold tracking-tight whitespace-nowrap">Kept AI</h1>
            <p className="hidden truncate text-sm text-muted-foreground sm:block">
              Save notes and links, then ask questions about them.
            </p>
          </div>
        </div>

        {/* Below sm the buttons are icon-only and a little tighter, so everything fits on a 320px phone. */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <StatusSummary items={items} />
          <Button variant="ghost" size="lg" onClick={onOpenHistory} aria-label="History" className={COMPACT}>
            <HistoryIcon aria-hidden />
            <span className="hidden sm:inline">History</span>
          </Button>
          {onNewChat && (
            <Button variant="ghost" size="lg" onClick={onNewChat} aria-label="New chat" className={COMPACT}>
              <SquarePenIcon aria-hidden />
              <span className="hidden sm:inline">New chat</span>
            </Button>
          )}
          <Button variant="outline" size="lg" onClick={onOpenItems} aria-label={`Saved items (${items.length})`} className={COMPACT}>
            <InboxIcon aria-hidden />
            <span className="hidden sm:inline">Saved items</span>
            <Pill tone="brand" className="px-2">
              {items.length}
            </Pill>
          </Button>
          <Button size="lg" onClick={onOpenAdd} aria-label="Add" className={COMPACT}>
            <PlusIcon aria-hidden />
            <span className="hidden min-[400px]:inline">Add</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
