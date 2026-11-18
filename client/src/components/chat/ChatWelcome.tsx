import { LayersIcon, PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ChatWelcomeProps {
  suggestions: string[]
  /** All saved items, whatever their status; 0 means the inbox is truly empty. */
  itemCount: number
  onAsk: (question: string) => void
  onAddContent: () => void
}

/**
 * Empty thread. Offers suggestions when something is searchable, a way to add content when the
 * inbox is empty, and otherwise (items still processing or failed) a short note on what to expect.
 */
export function ChatWelcome({ suggestions, itemCount, onAsk, onAddContent }: ChatWelcomeProps) {
  return (
    <div className="flex flex-col items-center gap-5 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-indigo-50 text-primary">
        <LayersIcon className="size-7" aria-hidden />
      </div>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-2xl font-semibold tracking-tight">Ask your inbox</h2>
        <p className="max-w-md text-muted-foreground">
          Answers come only from your saved notes and links, with numbered sources you can check.
        </p>
      </div>

      {suggestions.length > 0 ? (
        <div className="flex max-w-xl flex-wrap justify-center gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onAsk(suggestion)}
              className="rounded-full border bg-card px-3.5 py-1.5 text-sm shadow-xs transition-colors hover:bg-muted"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : itemCount === 0 ? (
        <Button onClick={onAddContent}>
          <PlusIcon aria-hidden />
          Add your first note or link
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          Your items become searchable once they show Ready in Saved items.
        </p>
      )}
    </div>
  )
}
