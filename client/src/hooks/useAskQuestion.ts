import { api } from '@/api/client'
import { useAsyncAction } from '@/hooks/useAsyncAction'

/** Asks a question over the saved content; exposes loading, error and the latest answer. */
export function useAskQuestion() {
  const { run, isPending, error, result } = useAsyncAction(api.ask)
  return { ask: run, isAsking: isPending, error, result }
}
