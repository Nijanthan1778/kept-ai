import { PlusIcon } from 'lucide-react'
import type { Item } from '@/api/types'
import { ItemList } from '@/components/inbox/ItemList'
import { Pill } from '@/components/Pill'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'

interface SavedItemsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: Item[]
  isLoading: boolean
  error: string | null
  onRemove: (id: string) => Promise<void>
  onAddContent: () => void
}

/** Right-hand drawer listing everything saved, with status and Remove. Only the list scrolls. */
export function SavedItemsSheet({ open, onOpenChange, items, isLoading, error, onRemove, onAddContent }: SavedItemsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <div className="flex items-center gap-2 pr-8">
            <SheetTitle className="text-lg">Saved items</SheetTitle>
            <Pill tone="indigo">{items.length === 1 ? '1 item' : `${items.length} items`}</Pill>
          </div>
          <SheetDescription>New items are searchable once they show Ready.</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          <ItemList items={items} isLoading={isLoading} error={error} onRemove={onRemove} />
        </div>

        <SheetFooter className="border-t">
          <Button onClick={onAddContent}>
            <PlusIcon aria-hidden />
            Add note or link
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
