import { CircleAlertIcon, CircleCheckIcon, Loader2Icon } from 'lucide-react'
import type { ItemStatus } from '@/api/types'
import { Badge } from '@/components/ui/badge'

export function ItemStatusBadge({ status }: { status: ItemStatus }) {
  switch (status) {
    case 'pending':
      return (
        <Badge variant="secondary">
          <Loader2Icon className="animate-spin" aria-hidden />
          Processing
        </Badge>
      )
    case 'ready':
      return (
        <Badge variant="outline">
          <CircleCheckIcon className="text-green-600" aria-hidden />
          Ready
        </Badge>
      )
    case 'failed':
      return (
        <Badge variant="destructive">
          <CircleAlertIcon aria-hidden />
          Failed
        </Badge>
      )
  }
}
