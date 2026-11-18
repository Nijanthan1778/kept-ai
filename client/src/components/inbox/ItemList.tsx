import type { Item } from '@/api/types'
import { ItemRow } from '@/components/inbox/ItemRow'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ItemListProps {
  items: Item[]
  isLoading: boolean
  error: string | null
  onRemove: (id: string) => Promise<void>
}

export function ItemList({ items, isLoading, error, onRemove }: ItemListProps) {
  return (
    <>
      {error && (
        <Alert variant="destructive" className="mb-3">
          <AlertDescription>Couldn't load items: {error}</AlertDescription>
        </Alert>
      )}
      {isLoading ? (
        <p className="py-5 text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="py-5 text-sm text-muted-foreground">Nothing saved yet. Add a note or a URL to get started.</p>
      ) : (
        <ul className="divide-y">
          {items.map((item) => (
            <ItemRow key={item.id} item={item} onRemove={onRemove} />
          ))}
        </ul>
      )}
    </>
  )
}
