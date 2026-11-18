/**
 * DOM id of a source card, so [n] citations can link and scroll to it. Includes the chat turn,
 * because every answer in the thread has its own sources numbered from 1.
 */
export function sourceElementId(turnId: string, index: number): string {
  return `source-${turnId}-${index}`
}
