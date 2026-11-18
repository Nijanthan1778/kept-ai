import { Loader2Icon, MessageSquareTextIcon, SquarePenIcon, Trash2Icon } from 'lucide-react'
import type { ConversationSummary } from '@/api/types'
import { Pill } from '@/components/Pill'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'

interface HistoryRowProps {
  conversation: ConversationSummary
  isActive: boolean
  onOpen: (id: string) => void
  onDelete: (id: string) => Promise<void>
}

function HistoryRow({ conversation, isActive, onOpen, onDelete }: HistoryRowProps) {
  const { run: remove, isPending: isDeleting, error: deleteError } = useAsyncAction(onDelete)
  const questions = conversation.turnCount === 1 ? '1 question' : `${conversation.turnCount} questions`

  return (
    <li>
      <div
        className={cn(
          'group flex items-center gap-1 rounded-lg pr-1 transition-colors hover:bg-muted',
          isActive && 'bg-indigo-50 hover:bg-indigo-50',
        )}
      >
        <button
          type="button"
          onClick={() => onOpen(conversation.id)}
          aria-current={isActive ? 'true' : undefined}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-lg px-3 py-2.5 text-left"
        >
          <MessageSquareTextIcon
            className={cn('mt-0.5 size-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')}
            aria-hidden
          />
          <span className="flex min-w-0 flex-col">
            <span className={cn('truncate text-sm font-medium', isActive && 'text-primary')}>{conversation.title}</span>
            <span className="text-xs text-muted-foreground">
              {questions} · {formatRelativeTime(conversation.updatedAt)}
            </span>
          </span>
        </button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete conversation "${conversation.title}"`}
          disabled={isDeleting}
          onClick={() => void remove(conversation.id)}
          className="shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
        >
          {isDeleting ? <Loader2Icon className="animate-spin" aria-hidden /> : <Trash2Icon aria-hidden />}
        </Button>
      </div>
      {deleteError && <p className="px-3 pb-1 text-xs text-destructive">Couldn't delete: {deleteError}</p>}
    </li>
  )
}

interface HistorySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversations: ConversationSummary[]
  activeId: string | null
  isLoading: boolean
  error: string | null
  onOpenConversation: (id: string) => void
  onDeleteConversation: (id: string) => Promise<void>
  onNewChat: () => void
}

/** Right-hand drawer listing past conversations, most recently active first. */
export function HistorySheet({
  open,
  onOpenChange,
  conversations,
  activeId,
  isLoading,
  error,
  onOpenConversation,
  onDeleteConversation,
  onNewChat,
}: HistorySheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-sm">
        <SheetHeader className="border-b">
          <div className="flex items-center gap-2 pr-8">
            <SheetTitle className="text-lg">History</SheetTitle>
            <Pill tone="indigo">{conversations.length}</Pill>
          </div>
          <SheetDescription>Your past conversations. Pick one to continue it.</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {error && (
            <Alert variant="destructive" className="mb-2">
              <AlertDescription>Couldn't load history: {error}</AlertDescription>
            </Alert>
          )}
          {isLoading ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">Loading…</p>
          ) : conversations.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">No conversations yet. Ask a question to start one.</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {conversations.map((conversation) => (
                <HistoryRow
                  key={conversation.id}
                  conversation={conversation}
                  isActive={conversation.id === activeId}
                  onOpen={onOpenConversation}
                  onDelete={onDeleteConversation}
                />
              ))}
            </ul>
          )}
        </div>

        <SheetFooter className="border-t">
          <Button onClick={onNewChat}>
            <SquarePenIcon aria-hidden />
            New chat
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
