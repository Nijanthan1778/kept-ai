import { useEffect, useRef } from 'react'
import { ChatTurnView } from '@/components/chat/ChatTurnView'
import type { ChatTurn } from '@/hooks/useConversations'

interface ChatThreadProps {
  turns: ChatTurn[]
  onRetry: (turn: ChatTurn) => void
}

export function ChatThread({ turns, onRetry }: ChatThreadProps) {
  const latestTurn = useRef<HTMLDivElement>(null)

  // When a question is asked, bring it to the top of the view so its answer reads top-down.
  // Only on new turns: expanding sources or a finished answer must not yank the scroll position.
  useEffect(() => {
    latestTurn.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [turns.length])

  return (
    <div className="flex flex-col gap-8">
      {turns.map((turn, i) => (
        <ChatTurnView key={turn.id} ref={i === turns.length - 1 ? latestTurn : undefined} turn={turn} onRetry={onRetry} />
      ))}
    </div>
  )
}
