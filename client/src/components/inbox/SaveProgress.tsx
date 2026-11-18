import { useEffect } from 'react'
import { CircleAlertIcon, CircleCheckIcon, Loader2Icon } from 'lucide-react'
import type { Item } from '@/api/types'
import { ItemIcon } from '@/components/inbox/ItemIcon'
import { ProcessingBar } from '@/components/inbox/ProcessingBar'
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { displayUrl, itemTitle } from '@/lib/format'
import { processingLabel } from '@/lib/processing'

/** A brief confirmation, so the user sees it succeeded, before the modal closes itself. */
const AUTO_CLOSE_AFTER_READY_MS = 1_000

const HEADINGS: Record<Item['status'], { title: string; description: string }> = {
  pending: {
    title: 'Processing…',
    description: 'You can close this window. Processing continues in the background.',
  },
  ready: { title: 'Ready to ask about', description: 'It is now searchable.' },
  failed: {
    title: "Couldn't process this item",
    description: 'Nothing was added to your searchable content. Close this window to try something else.',
  },
}

interface SaveProgressProps {
  item: Item
  onClose: () => void
}

/**
 * The modal's second step: follows the just-saved item. Closes itself once the item is ready;
 * on failure it stays open so the reason can be read, and the dialog's ✕ closes it.
 */
export function SaveProgress({ item, onClose }: SaveProgressProps) {
  // Ready: show the confirmation briefly, then close. Failed or still processing: stay open.
  useEffect(() => {
    if (item.status !== 'ready') return
    const timer = setTimeout(onClose, AUTO_CLOSE_AFTER_READY_MS)
    return () => clearTimeout(timer)
  }, [item.status, onClose])

  const heading = HEADINGS[item.status]

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-lg">
          {item.status === 'pending' && <Loader2Icon className="size-5 animate-spin text-amber-500" aria-hidden />}
          {item.status === 'ready' && <CircleCheckIcon className="size-5 text-emerald-600" aria-hidden />}
          {item.status === 'failed' && <CircleAlertIcon className="size-5 text-red-600" aria-hidden />}
          {heading.title}
        </DialogTitle>
        <DialogDescription>{heading.description}</DialogDescription>
      </DialogHeader>

      {/* min-w-0: as a grid item of the dialog it would otherwise grow to fit a long title instead of truncating it. */}
      <div className="flex min-w-0 gap-3 rounded-xl border p-3" aria-live="polite">
        <ItemIcon sourceType={item.sourceType} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="truncate font-semibold">{itemTitle(item)}</p>
          {item.url && <p className="truncate text-sm text-muted-foreground">{displayUrl(item.url)}</p>}

          {item.status === 'pending' && (
            <>
              <ProcessingBar item={item} className="mt-1" />
              <p className="text-xs text-muted-foreground">{processingLabel(item)}</p>
            </>
          )}
          {item.status === 'failed' && item.errorMessage && (
            <p className="rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-700">{item.errorMessage}</p>
          )}
        </div>
      </div>
    </>
  )
}
