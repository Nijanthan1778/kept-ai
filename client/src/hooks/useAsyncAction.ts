import { useCallback, useRef, useState } from 'react'
import { errorMessage } from '@/api/client'

/**
 * Pending / error / result state for one user-triggered async call (submit a form, ask a question).
 * If it is called again before the first call finishes, only the latest call's outcome is kept.
 */
export function useAsyncAction<Args extends unknown[], Result>(action: (...args: Args) => Promise<Result>) {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const latestCallId = useRef(0)

  const run = useCallback(
    async (...args: Args): Promise<Result | undefined> => {
      const callId = ++latestCallId.current
      setIsPending(true)
      setError(null)
      try {
        const value = await action(...args)
        if (callId === latestCallId.current) setResult(value)
        return value
      } catch (err) {
        if (callId === latestCallId.current) setError(errorMessage(err))
        return undefined
      } finally {
        if (callId === latestCallId.current) setIsPending(false)
      }
    },
    [action],
  )

  return { run, isPending, error, result }
}
