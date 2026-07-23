/**
 * Pointer-based shadow insertion (pure). The pointer — not the dragging
 * clone's center — decides where the shadow placeholder goes: the clone's
 * center crosses a card's midpoint BEFORE the pointer is over that card
 * (worse the further the grab point is from the center), so lib-proposed
 * indices made receivers hop to the far side of the cursor.
 */
import { shadowInsertAt } from "$lib/lib/stack-targeting";
import type { StripItemLike } from "./dnd-types";

export function shadowIndexOf<T extends StripItemLike>(items: T[]): number {
  return items.findIndex((i) => i.isDndShadowItem);
}

/**
 * Returns the items with the shadow moved to `domIndex`, or null when the
 * reorder is a no-op (caller declines the consider event).
 */
export function pointerShadowReorder<T extends StripItemLike>(
  items: T[],
  domIndex: number,
): T[] | null {
  const shadowIdx = shadowIndexOf(items);
  if (shadowIdx === -1) return null;
  const { insertAt, unchanged } = shadowInsertAt(domIndex, shadowIdx);
  if (unchanged) return null;
  const shadow = items[shadowIdx]!;
  const rest = items.filter((i) => !i.isDndShadowItem);
  const reordered = [
    ...rest.slice(0, insertAt),
    shadow,
    ...rest.slice(insertAt),
  ];
  return reordered.some((it, i) => it !== items[i]) ? reordered : null;
}
