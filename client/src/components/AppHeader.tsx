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
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <LayersIcon className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg leading-tight font-semibold tracking-tight">Kept AI</h1>
            <p className="hidden truncate text-sm text-muted-foreground sm:block">
              Save notes and links, then ask questions about them.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatusSummary items={items} />
          <Button variant="ghost" size="lg" onClick={onOpenHistory} aria-label="History">
            <HistoryIcon aria-hidden />
            <span className="hidden sm:inline">History</span>
          </Button>
          {onNewChat && (
            <Button variant="ghost" size="lg" onClick={onNewChat} aria-label="New chat">
              <SquarePenIcon aria-hidden />
              <span className="hidden sm:inline">New chat</span>
            </Button>
          )}
          <Button variant="outline" size="lg" onClick={onOpenItems}>
            <InboxIcon aria-hidden />
            <span className="hidden sm:inline">Saved items</span>
            <Pill tone="indigo" className="px-2">
              {items.length}
            </Pill>
          </Button>
          <Button size="lg" onClick={onOpenAdd}>
            <PlusIcon aria-hidden />
            Add
          </Button>
        </div>
      </div>
    </header>
  )
}
