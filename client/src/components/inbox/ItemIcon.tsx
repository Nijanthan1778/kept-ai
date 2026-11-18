import { FileTextIcon, LinkIcon } from 'lucide-react'
import type { SourceType } from '@/api/types'
import { cn } from '@/lib/utils'

/** Coloured tile showing whether an item is a note (theme accent) or a URL (teal). */
export function ItemIcon({ sourceType }: { sourceType: SourceType }) {
  const isUrl = sourceType === 'url'
  const Icon = isUrl ? LinkIcon : FileTextIcon
  return (
    <div
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-lg',
        isUrl ? 'bg-teal-50 text-teal-600' : 'bg-accent text-primary',
      )}
      aria-label={isUrl ? 'URL' : 'Note'}
    >
      <Icon className="size-5" aria-hidden />
    </div>
  )
}
