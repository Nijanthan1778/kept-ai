import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { ArrowUpIcon, Loader2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

// Same limit the server enforces.
const QUESTION_MAX_CHARS = 1_000

interface ChatComposerProps {
  onAsk: (question: string) => void
  isAsking: boolean
}

/** The message box pinned to the bottom of the chat. Enter sends, Shift+Enter adds a new line. */
export function ChatComposer({ onAsk, isAsking }: ChatComposerProps) {
  const [question, setQuestion] = useState('')
  const canSend = question.trim().length > 0 && !isAsking

  function send() {
    if (!canSend) return
    onAsk(question.trim())
    setQuestion('')
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    send()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // isComposing: don't send while an IME (e.g. Japanese or Chinese input) is mid-word.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      send()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex items-end gap-2 rounded-2xl border bg-card p-2 shadow-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
        <label htmlFor="question-input" className="sr-only">
          Question
        </label>
        <Textarea
          id="question-input"
          rows={1}
          maxLength={QUESTION_MAX_CHARS}
          placeholder="Ask anything about your saved notes and links…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          className="max-h-40 min-h-10 resize-none border-0 bg-transparent px-2 py-2 text-base shadow-none focus-visible:ring-0 md:text-base dark:bg-transparent"
        />
        <Button type="submit" size="icon-lg" disabled={!canSend} aria-label="Ask" className="shrink-0 rounded-xl">
          {isAsking ? <Loader2Icon className="animate-spin" aria-hidden /> : <ArrowUpIcon aria-hidden />}
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Answers come only from your saved content. AI can make mistakes, so check the sources.
      </p>
    </form>
  )
}
