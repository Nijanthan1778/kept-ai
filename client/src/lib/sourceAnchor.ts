/** DOM id of a source card, so [n] citations in an answer can link and scroll to it. */
export function sourceElementId(index: number): string {
  return `source-${index}`
}
