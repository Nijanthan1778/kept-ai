import { useMemo, useState } from 'react'
import { Loader2Icon } from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { ChatComposer } from '@/components/chat/ChatComposer'
import { ChatThread } from '@/components/chat/ChatThread'
import { ChatWelcome } from '@/components/chat/ChatWelcome'
import { HistorySheet } from '@/components/chat/HistorySheet'
import { AddContentDialog } from '@/components/inbox/AddContentDialog'
import { SavedItemsSheet } from '@/components/inbox/SavedItemsSheet'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useConversations } from '@/hooks/useConversations'
import { useItems } from '@/hooks/useItems'
import { buildSuggestions } from '@/lib/suggestions'

/**
 * Chat-first layout: the whole page is the conversation, with the composer pinned at the bottom.
 * History (left drawer), saved items (right drawer) and adding content (modal) open from the header.
 */
function App() {
  const { items, isLoading, error: itemsError, addItem, removeItem } = useItems()
  const chat = useConversations()
  const suggestions = useMemo(() => buildSuggestions(items), [items])
  const [isAddOpen, setAddOpen] = useState(false)
  const [isItemsOpen, setItemsOpen] = useState(false)
  const [isHistoryOpen, setHistoryOpen] = useState(false)

  function openAddFromItems() {
    setItemsOpen(false)
    setAddOpen(true)
  }

  function openConversation(id: string) {
    setHistoryOpen(false)
    void chat.openConversation(id)
  }

  function startNewChat() {
    setHistoryOpen(false)
    chat.newChat()
  }

  const hasConversation = chat.activeId !== null || chat.turns.length > 0

  return (
    <div className="flex h-svh flex-col bg-background">
      <AppHeader
        items={items}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenItems={() => setItemsOpen(true)}
        onOpenAdd={() => setAddOpen(true)}
        onNewChat={hasConversation ? startNewChat : undefined}
      />

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6">
          {chat.isOpening ? (
            <p className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" aria-hidden />
              Loading conversation…
            </p>
          ) : chat.openError ? (
            <Alert variant="destructive">
              <AlertDescription>Couldn't open this conversation: {chat.openError}</AlertDescription>
            </Alert>
          ) : chat.turns.length > 0 ? (
            <ChatThread turns={chat.turns} onRetry={chat.retry} />
          ) : (
            <ChatWelcome
              suggestions={suggestions}
              itemCount={items.length}
              onAsk={chat.ask}
              onAddContent={() => setAddOpen(true)}
            />
          )}
        </div>
      </main>

      <div className="shrink-0 bg-background">
        <div className="mx-auto max-w-3xl px-4 pt-2 pb-4">
          <ChatComposer onAsk={chat.ask} isAsking={chat.isAsking || chat.isOpening} />
        </div>
      </div>

      <HistorySheet
        open={isHistoryOpen}
        onOpenChange={setHistoryOpen}
        conversations={chat.history}
        activeId={chat.activeId}
        isLoading={chat.isLoadingHistory}
        error={chat.historyError}
        onOpenConversation={openConversation}
        onDeleteConversation={chat.deleteConversation}
        onNewChat={startNewChat}
      />
      <AddContentDialog open={isAddOpen} onOpenChange={setAddOpen} items={items} onIngested={addItem} />
      <SavedItemsSheet
        open={isItemsOpen}
        onOpenChange={setItemsOpen}
        items={items}
        isLoading={isLoading}
        error={itemsError}
        onRemove={removeItem}
        onAddContent={openAddFromItems}
      />
    </div>
  )
}

export default App
