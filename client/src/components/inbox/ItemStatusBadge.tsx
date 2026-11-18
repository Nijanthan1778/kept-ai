import { CheckIcon, CircleAlertIcon, Loader2Icon } from 'lucide-react'
import type { ItemStatus } from '@/api/types'
import { Pill } from '@/components/Pill'

export function ItemStatusBadge({ status }: { status: ItemStatus }) {
  switch (status) {
    case 'pending':
      return (
        <Pill tone="amber">
          <Loader2Icon className="animate-spin" aria-hidden />
          Processing
        </Pill>
      )
    case 'ready':
      return (
        <Pill tone="green">
          <CheckIcon aria-hidden />
          Ready
        </Pill>
      )
    case 'failed':
      return (
        <Pill tone="red">
          <CircleAlertIcon aria-hidden />
          Failed
        </Pill>
      )
  }
}
