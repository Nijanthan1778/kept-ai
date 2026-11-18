import { useState, type FormEvent } from 'react'
import { FileTextIcon, InfoIcon, LinkIcon, Loader2Icon } from 'lucide-react'
import { api } from '@/api/client'
import type { IngestInput, Item } from '@/api/types'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { isBareUrl } from '@/lib/bareUrl'
import { cn } from '@/lib/utils'

// Same limit the server enforces; checked here too so the user gets instant feedback.
const NOTE_MAX_CHARS = 20_000

type Mode = IngestInput['type']

const TAB_TRIGGER = 'gap-1.5 px-3 data-[state=active]:text-primary'

interface BareUrlHintProps {
  onSaveAsUrl: () => void
  disabled: boolean
}

/** Shown when the note is only a link: offers to save it as a URL so the page gets fetched. */
function BareUrlHint({ onSaveAsUrl, disabled }: BareUrlHintProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground" role="status">
      <p className="flex items-center gap-2">
        <InfoIcon className="size-4 shrink-0 text-primary" aria-hidden />
        This looks like a link. Save it as a URL so the page is fetched and searchable?
      </p>
      <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={onSaveAsUrl} className="shrink-0 bg-white">
        <LinkIcon aria-hidden />
        Save as URL
      </Button>
    </div>
  )
}

interface IngestFormProps {
  onIngested: (item: Item) => void
  onCancel: () => void
}

export function IngestForm({ onIngested, onCancel }: IngestFormProps) {
  const [mode, setMode] = useState<Mode>('note')
  const [note, setNote] = useState('')
  const [url, setUrl] = useState('')
  const { run, isPending, error } = useAsyncAction(api.ingest)

  const value = mode === 'note' ? note : url
  const tooLong = mode === 'note' && note.length > NOTE_MAX_CHARS
  const canSubmit = value.trim().length > 0 && !tooLong && !isPending
  // A note that is only a link would be stored as that text; the page itself would never be fetched.
  const noteIsBareUrl = mode === 'note' && isBareUrl(note)

  /** Saves the input and, on success, clears the field the text came from. */
  async function save(input: IngestInput, clearField: () => void) {
    const item = await run(input)
    if (item) {
      onIngested(item)
      clearField()
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    if (mode === 'note') void save({ type: 'note', content: note }, () => setNote(''))
    else void save({ type: 'url', url: url.trim() }, () => setUrl(''))
  }

  function saveNoteAsUrl() {
    void save({ type: 'url', url: note.trim() }, () => setNote(''))
  }

  return (
    <Tabs value={mode} onValueChange={(next) => setMode(next as Mode)} className="gap-4">
      <TabsList className="h-9 p-1">
        <TabsTrigger value="note" className={TAB_TRIGGER}>
          <FileTextIcon aria-hidden />
          Note
        </TabsTrigger>
        <TabsTrigger value="url" className={TAB_TRIGGER}>
          <LinkIcon aria-hidden />
          URL
        </TabsTrigger>
      </TabsList>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <TabsContent value="note" className="flex flex-col gap-2">
          <label htmlFor="note-input" className="text-sm font-medium">
            Note
          </label>
          <Textarea
            id="note-input"
            placeholder="Write or paste a note…"
            className="max-h-72 min-h-32"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </TabsContent>
        <TabsContent value="url" className="flex flex-col gap-2">
          <label htmlFor="url-input" className="text-sm font-medium">
            URL
          </label>
          <Input
            id="url-input"
            type="url"
            placeholder="https://example.com/article"
            className="h-10"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            The page is fetched on the server and its readable text is saved. Pages that need JavaScript or a login
            can't be read.
          </p>
        </TabsContent>

        {noteIsBareUrl && <BareUrlHint onSaveAsUrl={saveNoteAsUrl} disabled={isPending} />}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between gap-3">
          <p className={cn('text-sm', tooLong ? 'text-destructive' : 'text-muted-foreground')}>
            {mode === 'note' && `${note.length.toLocaleString()} / ${NOTE_MAX_CHARS.toLocaleString()}`}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="lg" onClick={onCancel} className="h-10 px-5">
              Cancel
            </Button>
            <Button type="submit" size="lg" disabled={!canSubmit} className="h-10 px-5">
              {isPending && <Loader2Icon className="animate-spin" aria-hidden />}
              {mode === 'note' ? 'Save note' : 'Save URL'}
            </Button>
          </div>
        </div>
      </form>
    </Tabs>
  )
}
