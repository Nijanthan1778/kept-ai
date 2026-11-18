import type { Item, ProcessingStage } from '@/api/types'

const STAGE_LABELS: Record<ProcessingStage, string> = {
  fetching: 'Fetching page…',
  chunking: 'Splitting into chunks…',
  embedding: 'Embedding chunks…',
  saving: 'Saving…',
}

/** Notes skip the fetch, so they have one stage fewer. */
function stagesFor(item: Item): ProcessingStage[] {
  return item.sourceType === 'url' ? ['fetching', 'chunking', 'embedding', 'saving'] : ['chunking', 'embedding', 'saving']
}

export function processingLabel(item: Item): string {
  return item.processingStage ? STAGE_LABELS[item.processingStage] : 'Queued…'
}

/**
 * How far along a pending item is, from 0 to 1. Each stage counts as half done while it runs,
 * so the bar always moves forward and never shows 100% before the item is actually ready.
 */
export function processingProgress(item: Item): number {
  if (!item.processingStage) return 0.05
  const stages = stagesFor(item)
  const index = stages.indexOf(item.processingStage)
  return (index + 0.5) / stages.length
}
