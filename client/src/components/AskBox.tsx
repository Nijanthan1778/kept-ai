import { useState, type FormEvent } from 'react'
import { Loader2Icon, SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Same limit the server enforces.
const QUESTION_MAX_CHARS = 1_000

interface AskBoxProps {
  onAsk: (question: string) => void
  isAsking: boolean
}

export function AskBox({ onAsk, isAsking }: AskBoxProps) {
  const [question, setQuestion] = useState('')
  const canSubmit = question.trim().length > 0 && !isAsking

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (canSubmit) onAsk(question.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        aria-label="Question"
        placeholder="Ask something about your saved content…"
        maxLength={QUESTION_MAX_CHARS}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />
      <Button type="submit" disabled={!canSubmit}>
        {isAsking ? <Loader2Icon className="animate-spin" aria-hidden /> : <SearchIcon aria-hidden />}
        Ask
      </Button>
    </form>
  )
}
