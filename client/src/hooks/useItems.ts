import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError, errorMessage } from '@/api/client'
import type { Item } from '@/api/types'

const POLL_INTERVAL_MS = 2_000

/**
 * The saved items list. Polls only while some item is still `pending`, so an idle inbox
 * makes no requests; polling stops by itself once everything is `ready` or `failed`.
 */
export function useItems() {
  const [items, setItems] = useState<Item[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  const refresh = useCallback(async () => {
    if (inFlight.current) return // a slow response must not stack up overlapping polls
    inFlight.current = true
    try {
      setItems(await api.listItems())
      setError(null)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      inFlight.current = false
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // Initial load from the server: syncing with an external system, which is what effects are for.
    // State is only set after the request resolves, not synchronously.
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh()
  }, [refresh])

  const hasPending = items.some((item) => item.status === 'pending')
  useEffect(() => {
    if (!hasPending) return
    const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [hasPending, refresh])

  /** Shows a just-ingested item immediately (which also starts polling) without a refetch. */
  const addItem = useCallback((item: Item) => {
    setItems((current) => [item, ...current.filter((existing) => existing.id !== item.id)])
  }, [])

  /** Deletes an item on the server, then drops it from the list. Throws on failure. */
  const removeItem = useCallback(async (id: string) => {
    try {
      await api.removeItem(id)
    } catch (err) {
      // Already gone on the server (e.g. removed in another tab): still drop it here.
      if (!(err instanceof ApiError && err.status === 404)) throw err
    }
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  return { items, isLoading, error, addItem, removeItem }
}
