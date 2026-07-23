/**
 * Pointer-based insertion for the slide strip's dnd zone.
 *
 * Why this exists: svelte-dnd-action proposes its "would-be" insertion
 * index from the floating clone's CENTER (see the lib's helpers/observer +
 * helpers/listUtil). The clone's center crosses a card's midpoint up to
 * half a card-width BEFORE the pointer does (the gap is bigger the further
 * the grab point is from the card center). Applying those considers moved
 * the target card to the far side of the pointer — the "receiver runs
 * away" stacking bug: you chase the card, it hops again, forever.
 *
 * The strip therefore converts consider events into pointer-based
 * placement: the shadow may only advance to a slot the pointer itself has
 * reached, so a receiver card can never leapfrog the pointer. Combined
 * with the stack-zone hover suppression in the slide-strip dnd controller, hovering a
 * card pins it completely until you drop (stack) or leave (reorder
 * resumes).
 */

/**
 * Returns the insertion index in DOM-child coordinates (the list WITH the
 * shadow placeholder): the first child whose center lies strictly right of
 * the pointer, i.e. "insert before that child".
 */
export function pointerInsertIndex(pointerX: number, childCenters: number[]): number {
  for (let i = 0; i < childCenters.length; i++) {
    if (childCenters[i]! > pointerX) return i;
  }
  return childCenters.length;
}

/**
 * Maps a DOM-children insertion index (list WITH the shadow card sitting at
 * `shadowIndex`) to an insertion position in the shadow-less list.
 *
 * `unchanged` is true when the shadow would land back on its own slot — the
 * caller then declines the consider entirely, pinning the layout exactly as
 * it stands even though the library asked for a reorder.
 */
export function shadowInsertAt(
  domIndex: number,
  shadowIndex: number,
): { insertAt: number; unchanged: boolean } {
  const insertAt = domIndex > shadowIndex ? domIndex - 1 : domIndex;
  return { insertAt, unchanged: insertAt === shadowIndex };
}
