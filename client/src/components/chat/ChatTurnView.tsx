import { forwardRef } from 'react'
import { LayersIcon, Loader2Icon, RotateCcwIcon } from 'lucide-react'
import { AnswerView } from '@/components/chat/AnswerView'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { ChatTurn } from '@/hooks/useConversations'

function AssistantAvatar() {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary" aria-hidden>
      <LayersIcon className="size-4" />
    </div>
  )
}

interface ChatTurnViewProps {
  turn: ChatTurn
  onRetry: (turn: ChatTurn) => void
}

/** A question bubble on the right, and the answer (or its loading/error state) below it. */
export const ChatTurnView = forwardRef<HTMLDivElement, ChatTurnViewProps>(function ChatTurnView({ turn, onRetry }, ref) {
  return (
    <div ref={ref} className="flex scroll-mt-4 flex-col gap-4">
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-2 text-sm whitespace-pre-wrap text-foreground">
          {turn.question}
        </p>
      </div>

      <div className="flex gap-3">
        <AssistantAvatar />
        <div className="min-w-0 flex-1 pt-1">
          {turn.status === 'pending' && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" aria-hidden />
              Searching your saved content and writing an answer…
            </p>
          )}

          {turn.status === 'failed' && (
            <Alert variant="destructive" className="flex items-center justify-between gap-3">
              <AlertDescription>{turn.error}</AlertDescription>
              <Button variant="outline" size="sm" onClick={() => onRetry(turn)} className="shrink-0">
                <RotateCcwIcon aria-hidden />
                Retry
              </Button>
            </Alert>
          )}

          {turn.status === 'answered' && turn.result && <AnswerView turnId={turn.id} result={turn.result} />}
        </div>
      </div>
    </div>
  )
})
