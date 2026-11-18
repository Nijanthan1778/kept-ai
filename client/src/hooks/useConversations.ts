import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError, errorMessage } from '@/api/client'
import type { ConversationSummary, ConversationTurn, QueryResult } from '@/api/types'

export type TurnStatus = 'pending' | 'answered' | 'failed'

/** One question and its answer as shown in the chat thread. */
export interface ChatTurn {
  id: string
  question: string
  status: TurnStatus
  result: QueryResult | null
  error: string | null
}

function fromSavedTurn(turn: ConversationTurn): ChatTurn {
  return {
    id: turn.id,
    question: turn.question,
    status: 'answered',
    result: { answer: turn.answer, sources: turn.sources },
    error: null,
  }
}

/**
 * The open conversation plus the saved history. Conversations live on the server: each answered
 * question is stored, so history survives refreshes. Failed questions stay local, with Retry.
 */
export function useConversations() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [isOpening, setIsOpening] = useState(false)
  const [openError, setOpenError] = useState<string | null>(null)

  const [history, setHistory] = useState<ConversationSummary[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)

  // Bumped whenever the visible conversation changes, so a slow answer or load that arrives
  // after the user switched away doesn't overwrite the conversation now on screen.
  const view = useRef(0)

  const refreshHistory = useCallback(async () => {
    try {
      setHistory(await api.listConversations())
      setHistoryError(null)
    } catch (err) {
      setHistoryError(errorMessage(err))
    } finally {
      setIsLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    // Initial load from the server: syncing with an external system, which is what effects are for.
    // oxlint-disable-next-line react/set-state-in-effect
    void refreshHistory()
  }, [refreshHistory])

  const updateTurn = useCallback((id: string, patch: Partial<ChatTurn>) => {
    setTurns((current) => current.map((turn) => (turn.id === id ? { ...turn, ...patch } : turn)))
  }, [])

  const answer = useCallback(
    async (turnId: string, question: string, conversationId: string | null) => {
      const viewAtAsk = view.current
      try {
        const { answer, sources, conversationId: savedTo } = await api.ask(question, conversationId ?? undefined)
        if (view.current === viewAtAsk) {
          setActiveId(savedTo) // a first question creates the conversation
          updateTurn(turnId, { status: 'answered', result: { answer, sources }, error: null })
        }
        void refreshHistory()
      } catch (err) {
        if (view.current === viewAtAsk) updateTurn(turnId, { status: 'failed', error: errorMessage(err) })
      }
    },
    [refreshHistory, updateTurn],
  )

  const ask = useCallback(
    (question: string) => {
      const id = crypto.randomUUID()
      setTurns((current) => [...current, { id, question, status: 'pending', result: null, error: null }])
      void answer(id, question, activeId)
    },
    [activeId, answer],
  )

  const retry = useCallback(
    (turn: ChatTurn) => {
      updateTurn(turn.id, { status: 'pending', error: null })
      void answer(turn.id, turn.question, activeId)
    },
    [activeId, answer, updateTurn],
  )

  const newChat = useCallback(() => {
    view.current++
    setActiveId(null)
    setTurns([])
    setOpenError(null)
    setIsOpening(false)
  }, [])

  const openConversation = useCallback(async (id: string) => {
    const viewAtOpen = ++view.current
    setActiveId(id)
    setTurns([])
    setOpenError(null)
    setIsOpening(true)
    try {
      const conversation = await api.getConversation(id)
      if (view.current === viewAtOpen) setTurns(conversation.turns.map(fromSavedTurn))
    } catch (err) {
      if (view.current === viewAtOpen) setOpenError(errorMessage(err))
    } finally {
      if (view.current === viewAtOpen) setIsOpening(false)
    }
  }, [])

  /** Deletes on the server (already gone counts as success); leaves the chat if it was open. */
  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await api.deleteConversation(id)
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404)) throw err
      }
      if (id === activeId) newChat()
      setHistory((current) => current.filter((conversation) => conversation.id !== id))
    },
    [activeId, newChat],
  )

  return {
    activeId,
    turns,
    isOpening,
    openError,
    isAsking: turns.some((turn) => turn.status === 'pending'),
    ask,
    retry,
    newChat,
    openConversation,
    deleteConversation,
    history,
    isLoadingHistory,
    historyError,
  }
}
