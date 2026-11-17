import { useState, type FormEvent } from 'react'
import { Loader2Icon } from 'lucide-react'
import { api } from '@/api/client'
import type { IngestInput, Item } from '@/api/types'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

// Same limit the server enforces; checked here too so the user gets instant feedback.
const NOTE_MAX_CHARS = 20_000

type Mode = IngestInput['type']

export function IngestForm({ onIngested }: { onIngested: (item: Item) => void }) {
  const [mode, setMode] = useState<Mode>('note')
  const [note, setNote] = useState('')
  const [url, setUrl] = useState('')
  const { run, isPending, error } = useAsyncAction(api.ingest)

  const value = mode === 'note' ? note : url
  const tooLong = mode === 'note' && note.length > NOTE_MAX_CHARS
  const canSubmit = value.trim().length > 0 && !tooLong && !isPending

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    const input: IngestInput = mode === 'note' ? { type: 'note', content: note } : { type: 'url', url: url.trim() }
    const item = await run(input)
    if (item) {
      onIngested(item)
      if (mode === 'note') setNote('')
      else setUrl('')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add to your inbox</CardTitle>
        <CardDescription>Save a note, or a URL to fetch and read.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Tabs value={mode} onValueChange={(next) => setMode(next as Mode)}>
            <TabsList>
              <TabsTrigger value="note">Note</TabsTrigger>
              <TabsTrigger value="url">URL</TabsTrigger>
            </TabsList>
            <TabsContent value="note" className="flex flex-col gap-1">
              <Textarea
                aria-label="Note"
                placeholder="Write or paste a note…"
                rows={5}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <p className={`text-right text-xs ${tooLong ? 'text-destructive' : 'text-muted-foreground'}`}>
                {note.length.toLocaleString()} / {NOTE_MAX_CHARS.toLocaleString()}
              </p>
            </TabsContent>
            <TabsContent value="url">
              <Input
                aria-label="URL"
                type="url"
                placeholder="https://example.com/article"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </TabsContent>
          </Tabs>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={!canSubmit} className="self-end">
            {isPending && <Loader2Icon className="animate-spin" aria-hidden />}
            {mode === 'note' ? 'Save note' : 'Save URL'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
