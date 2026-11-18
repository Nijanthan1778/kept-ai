import { FileTextIcon, LinkIcon } from 'lucide-react'
import type { SourceType } from '@/api/types'
import { cn } from '@/lib/utils'

/** Coloured tile showing whether an item is a note (indigo) or a URL (sky). */
export function ItemIcon({ sourceType }: { sourceType: SourceType }) {
  const isUrl = sourceType === 'url'
  const Icon = isUrl ? LinkIcon : FileTextIcon
  return (
    <div
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-lg',
        isUrl ? 'bg-sky-50 text-sky-600' : 'bg-indigo-50 text-indigo-600',
      )}
      aria-label={isUrl ? 'URL' : 'Note'}
    >
      <Icon className="size-5" aria-hidden />
    </div>
  )
}
