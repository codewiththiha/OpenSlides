/**
 * Stack-hover geometry (pure). Fractions of a card rect:
 * ENTER = visible dashed zone; EXIT = larger "stay" region so pointer
 * jitter near the edge doesn't drop the target (hysteresis).
 */
import type { StackHoverElement } from "./dnd-types";

const STACK_ENTER_X = 0.16;
const STACK_ENTER_Y = 0.12;
const STACK_EXIT_X = 0.05;
const STACK_EXIT_Y = 0.04;

export function findStackHoverId(opts: {
  pointer: { x: number; y: number };
  /** Ids belonging to the dragged item (never a valid target). */
  draggingIds: Set<string>;
  /** Section of the dragged item — stacking onto a sibling is meaningless. */
  draggedSection: string | null;
  /** Currently hovered target — hysteresis gives it the larger stay region. */
  currentHoverId: string | null;
  elements: StackHoverElement[];
}): string | null {
  const { pointer, draggingIds, draggedSection, currentHoverId, elements } = opts;
  for (const el of elements) {
    if (draggingIds.has(el.id)) continue;
    if (draggedSection && el.section && el.section === draggedSection) continue;
    const r = el.rect;
    const ix = currentHoverId === el.id ? STACK_EXIT_X : STACK_ENTER_X;
    const iy = currentHoverId === el.id ? STACK_EXIT_Y : STACK_ENTER_Y;
    if (
      pointer.x >= r.left + r.width * ix &&
      pointer.x <= r.right - r.width * ix &&
      pointer.y >= r.top + r.height * iy &&
      pointer.y <= r.bottom - r.height * iy
    ) {
      return el.id;
    }
  }
  return null;
}
