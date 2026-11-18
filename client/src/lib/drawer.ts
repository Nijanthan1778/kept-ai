/**
 * Width of the right-hand drawers (History, Saved items): full screen on phones, 448px from
 * tablet width up (a little wider than shadcn's 384px default).
 *
 * `!` (important) is needed: shadcn's SheetContent sets its width with `data-[side=right]:` classes,
 * whose attribute selector is more specific than a plain `w-*` / `max-w-*` class and would win.
 */
export const DRAWER_WIDTH = '!w-full sm:!max-w-md'
