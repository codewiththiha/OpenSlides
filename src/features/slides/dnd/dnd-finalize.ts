/**
 * Finalize (drop) decision (pure): compare the final dnd order against the
 * pre-drag base order and decide what to commit.
 */
import type { FinalizeDecision, StripItemLike } from "./dnd-types";

export function idsEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => b[i] === v);
}

export function decideFinalize(opts: {
  /** Final items from the lib (shadow placeholder still inside). */
  items: StripItemLike[];
  /** Pre-drag items (what's actually rendered outside a drag). */
  baseItems: StripItemLike[];
  /** While the strip filter is active, dragging is disabled. */
  filtering: boolean;
  /** False when the drag failed to resolve its source payload. */
  hasSource: boolean;
  stackTargetId: string | null;
}): FinalizeDecision {
  const { items, baseItems, filtering, hasSource, stackTargetId } = opts;

  if (filtering || !hasSource) return { kind: "restore" };

  // Center drop → stack the dragged whole onto the target card.
  if (stackTargetId) return { kind: "stack", targetId: stackTargetId };

  const clean = items.filter((i) => !i.isDndShadowItem);
  const nextIds = clean.flatMap((i) => i.slides.map((s) => s.id));
  const prevIds = baseItems.flatMap((i) => i.slides.map((s) => s.id));

  return idsEqual(nextIds, prevIds)
    ? { kind: "noop" }
    : { kind: "reorder", nextIds };
}
