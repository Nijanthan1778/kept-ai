import { AnswerView } from '@/components/AnswerView'
import { AskBox } from '@/components/AskBox'
import { IngestForm } from '@/components/IngestForm'
import { ItemList } from '@/components/ItemList'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAskQuestion } from '@/hooks/useAskQuestion'
import { useItems } from '@/hooks/useItems'

function App() {
  const { items, isLoading, error: itemsError, addItem } = useItems()
  const { ask, isAsking, error: askError, result } = useAskQuestion()

  return (
    <div className="min-h-svh bg-muted/30">
      <main className="mx-auto flex max-w-6xl flex-col gap-6 p-4 md:p-8">
        <header>
          <h1 className="text-2xl font-semibold">Kept AI</h1>
          <p className="text-muted-foreground">Save notes and links, then ask questions about them.</p>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[2fr_3fr]">
          <div className="flex flex-col gap-6">
            <IngestForm onIngested={addItem} />
            <ItemList items={items} isLoading={isLoading} error={itemsError} />
          </div>

          <Card className="lg:sticky lg:top-8">
            <CardHeader>
              <CardTitle>Ask your inbox</CardTitle>
              <CardDescription>Answers come only from your saved content, with numbered sources.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <AskBox onAsk={ask} isAsking={isAsking} />
              {askError && (
                <Alert variant="destructive">
                  <AlertDescription>{askError}</AlertDescription>
                </Alert>
              )}
              {isAsking && <p className="text-sm text-muted-foreground">Searching your content and writing an answer…</p>}
              {!isAsking && result && <AnswerView result={result} />}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

export default App
