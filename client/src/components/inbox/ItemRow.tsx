import { Loader2Icon } from 'lucide-react'
import type { Item } from '@/api/types'
import { ItemIcon } from '@/components/inbox/ItemIcon'
import { ItemStatusBadge } from '@/components/inbox/ItemStatusBadge'
import { ProcessingBar } from '@/components/inbox/ProcessingBar'
import { Button } from '@/components/ui/button'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { displayUrl, formatRelativeTime, itemTitle } from '@/lib/format'
import { processingLabel } from '@/lib/processing'

interface ItemRowProps {
  item: Item
  onRemove: (id: string) => Promise<void>
}

export function ItemRow({ item, onRemove }: ItemRowProps) {
  const { run: remove, isPending: isRemoving, error: removeError } = useAsyncAction(onRemove)
  const typeLabel = item.sourceType === 'url' ? 'URL' : 'Note'
  const meta = item.status === 'pending' ? processingLabel(item) : formatRelativeTime(item.createdAt)

  return (
    <li className="flex gap-4 py-3">
      <ItemIcon sourceType={item.sourceType} />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="truncate font-semibold">{itemTitle(item)}</h3>
          <ItemStatusBadge status={item.status} />
        </div>

        {item.url && (
          <a href={item.url} target="_blank" rel="noreferrer" className="truncate text-sm text-primary hover:underline">
            {displayUrl(item.url)}
          </a>
        )}

        {item.status === 'pending' && <ProcessingBar item={item} />}

        {item.status === 'failed' && item.errorMessage && (
          <p className="rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-700">{item.errorMessage}</p>
        )}

        {item.preview && item.status !== 'failed' && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{item.preview}</p>
        )}

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {typeLabel} ·{' '}
            {item.status === 'pending' ? (
              meta
            ) : (
              <time dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString()}>
                {meta}
              </time>
            )}
          </p>
          <Button variant="outline" size="xs" disabled={isRemoving} onClick={() => void remove(item.id)}>
            {isRemoving && <Loader2Icon className="animate-spin" aria-hidden />}
            Remove
          </Button>
        </div>
        {removeError && <p className="text-xs text-destructive">Couldn't remove: {removeError}</p>}
      </div>
    </li>
  )
}
