import { useCallback, useState } from 'react'
import { PlusIcon } from 'lucide-react'
import type { Item } from '@/api/types'
import { IngestForm } from '@/components/inbox/IngestForm'
import { SaveProgress } from '@/components/inbox/SaveProgress'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface AddContentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Live item list (kept fresh by polling); used to follow the saved item's progress. */
  items: Item[]
  onIngested: (item: Item) => void
}

interface AddContentFlowProps {
  items: Item[]
  onIngested: (item: Item) => void
  onClose: () => void
}

/**
 * Step 1: the form. Step 2: progress of the item just saved, read from the live item list.
 * Lives inside DialogContent, which unmounts on close, so reopening always starts at step 1.
 */
function AddContentFlow({ items, onIngested, onClose }: AddContentFlowProps) {
  const [saved, setSaved] = useState<Item | null>(null)

  if (saved) {
    // Fall back to the 202 response until the first poll includes the item.
    const latest = items.find((item) => item.id === saved.id) ?? saved
    return <SaveProgress item={latest} onClose={onClose} />
  }

  return (
    <>
      <DialogHeader className="flex-row items-center gap-3 text-left">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary" aria-hidden>
          <PlusIcon className="size-5" />
        </div>
        <div className="flex flex-col gap-0.5">
          <DialogTitle className="text-lg">Add to your inbox</DialogTitle>
          <DialogDescription>Save a note, or a URL to fetch and read.</DialogDescription>
        </div>
      </DialogHeader>
      <IngestForm
        onIngested={(item) => {
          onIngested(item)
          setSaved(item)
        }}
        onCancel={onClose}
      />
    </>
  )
}

/** The "Add" modal: save a note or URL, then watch it process until it is ready. */
export function AddContentDialog({ open, onOpenChange, items, onIngested }: AddContentDialogProps) {
  // Stable reference: SaveProgress's auto-close timer depends on it and must not restart on every poll.
  const close = useCallback(() => onOpenChange(false), [onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Only the ✕ button closes it (or auto-close once ready): a stray click outside or Escape
          must not throw away a half-typed note or hide the progress of a save. */}
      <DialogContent
        className="gap-5 sm:max-w-lg"
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <AddContentFlow items={items} onIngested={onIngested} onClose={close} />
      </DialogContent>
    </Dialog>
  )
}
