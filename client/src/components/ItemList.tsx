import { LinkIcon, StickyNoteIcon } from 'lucide-react'
import type { Item } from '@/api/types'
import { ItemStatusBadge } from '@/components/ItemStatusBadge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatRelativeTime, hostname } from '@/lib/format'

function itemTitle(item: Item): string {
  if (item.title) return item.title
  if (item.url) return hostname(item.url)
  return 'Untitled note'
}

function ItemRow({ item }: { item: Item }) {
  const Icon = item.sourceType === 'url' ? LinkIcon : StickyNoteIcon
  return (
    <li className="flex flex-col gap-1 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-label={item.sourceType} />
          <span className="truncate font-medium">{itemTitle(item)}</span>
        </div>
        <ItemStatusBadge status={item.status} />
      </div>

      {item.url && (
        <a href={item.url} target="_blank" rel="noreferrer" className="truncate text-xs text-muted-foreground hover:underline">
          {item.url}
        </a>
      )}
      {item.status === 'failed' && item.errorMessage && (
        <p className="text-sm text-destructive">{item.errorMessage}</p>
      )}
      {item.preview && <p className="line-clamp-2 text-sm text-muted-foreground">{item.preview}</p>}
      <time dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString()} className="text-xs text-muted-foreground">
        {formatRelativeTime(item.createdAt)}
      </time>
    </li>
  )
}

interface ItemListProps {
  items: Item[]
  isLoading: boolean
  error: string | null
}

export function ItemList({ items, isLoading, error }: ItemListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Saved items</CardTitle>
        <CardDescription>
          {items.length === 1 ? '1 item' : `${items.length} items`}. New items are searchable once they show Ready.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-3">
            <AlertDescription>Couldn't load items: {error}</AlertDescription>
          </Alert>
        )}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing saved yet. Add a note or a URL to get started.</p>
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
