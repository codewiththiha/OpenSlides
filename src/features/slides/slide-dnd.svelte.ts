/**
 * Slide-strip drag state (svelte-dnd-action).
 *
 * - Stack drops are detected with a pointer tracker: rect-math hit zones
 *   on data-stack-card wrappers (data-stack-target overlays are pure
 *   feedback) — "center means stack, edges mean reorder". While the
 *   pointer sits inside a stack zone, consider-events are NOT applied, so
 *   the receiver card can't slide out from under the cursor.
 * - Reorders that DO apply are placed by the POINTER
 *   (lib/stack-targeting), not by the dragging clone's center — otherwise
 *   the center crosses a card's midpoint while the pointer is still short
 *   of it and the receiver keeps hopping to the far side of the cursor.
 * - The lib-generated dragged clone follows the pointer; a dashed shadow
 *   placeholder marks the insertion slot.
 */
import { untrack } from "svelte";
import { TRIGGERS, SOURCES, type DndEvent } from "svelte-dnd-action";
import { pointerInsertIndex, shadowInsertAt } from "$lib/lib/stack-targeting";
import type { Slide } from "$lib/types";
import type { StripItem } from "./slide-strip-state.svelte";

const DRAGGED_CLONE_SELECTOR = "#dnd-action-dragged-el";

/* Stack targeting geometry — fractions of a card rect.
   ENTER = visible dashed zone; EXIT = larger "stay" region so pointer
   jitter near the edge doesn't drop the target (hysteresis). */
const STACK_ENTER_X = 0.16;
const STACK_ENTER_Y = 0.12;
const STACK_EXIT_X = 0.05;
const STACK_EXIT_Y = 0.04;

export function createSlideStripDnd(args: {
  baseItems: () => StripItem[];
  /** True while the strip search filter is active (dragging disabled). */
  filtering: () => boolean;
  /** A visible card maps to its whole slide section, even a lone member. */
  resolveSourceIds: (activeId: string) => string[];
  ordered: () => Slide[];
  setOrdered: (slides: Slide[]) => void;
  onStack: (sourceIds: string[], targetId: string) => void;
  onReorder: (slideIds: string[], opts: { onError: () => void }) => void;
}) {
  let dndItems = $state<StripItem[]>([]);
  let draggingId = $state<string | null>(null);
  let stackHoverId = $state<string | null>(null);
  /** Payload of the dragged item, snapshotted at DRAG_STARTED. */
  let dragSource: StripItem | null = null;
  const pointer = { x: 0, y: 0 };
  let zoneEl = $state<HTMLElement | undefined>(undefined);

  $effect(() => {
    const base = args.baseItems();
    untrack(() => {
      if (draggingId) return; // never clobber an in-flight drag preview
      if (
        dndItems.length !== base.length ||
        base.some(
          (b, i) =>
            dndItems[i]?.id !== b.id ||
            dndItems[i]?.slides !== b.slides ||
            dndItems[i]?.expanded !== b.expanded,
        )
      ) {
        dndItems = base;
      }
    });
  });

  let hoverRaf = 0;
  function updateStackHover() {
    if (!draggingId || !dragSource) {
      stackHoverId = null;
      return;
    }
    const draggedSection = dragSource.slides[0]?.sectionId?.trim() || null;
    const draggedIds = new Set(dragSource.slides.map((s) => s.id));
    const els = document.querySelectorAll<HTMLElement>("[data-stack-card]");
    let found: string | null = null;
    for (const el of els) {
      // Ignore the lib-generated dragged clone and the dragged source itself.
      if (el.closest(DRAGGED_CLONE_SELECTOR)) continue;
      const targetId = el.getAttribute("data-stack-card");
      if (!targetId || draggedIds.has(targetId)) continue;
      // Stacking onto a sibling of the same section is meaningless.
      const section = el.dataset.stackSection?.trim();
      if (draggedSection && section && section === draggedSection) continue;
      const r = el.getBoundingClientRect();
      // Hysteresis: the currently-hovered card keeps its larger "stay" region.
      const ix = stackHoverId === targetId ? STACK_EXIT_X : STACK_ENTER_X;
      const iy = stackHoverId === targetId ? STACK_EXIT_Y : STACK_ENTER_Y;
      if (
        pointer.x >= r.left + r.width * ix &&
        pointer.x <= r.right - r.width * ix &&
        pointer.y >= r.top + r.height * iy &&
        pointer.y <= r.bottom - r.height * iy
      ) {
        found = targetId;
        break;
      }
    }
    stackHoverId = found;
  }

  function onPointerMove(e: PointerEvent) {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    // One hit-test per frame max — keeps 60fps during drag.
    if (!hoverRaf) {
      hoverRaf = requestAnimationFrame(() => {
        hoverRaf = 0;
        updateStackHover();
      });
    }
  }

  function handleConsider(e: CustomEvent<DndEvent<StripItem>>) {
    const { items: next, info } = e.detail;

    // ── Drag start: always apply so the shadow placeholder appears ──
    if (info.trigger === TRIGGERS.DRAG_STARTED && info.source === SOURCES.POINTER) {
      draggingId = String(info.id);
      dragSource = dndItems.find((i) => i.id === draggingId) ?? null;
      window.addEventListener("pointermove", onPointerMove);
      dndItems = next; // shadow placeholder replaces the dragged card
      return;
    }

    // ── Hit-test BEFORE applying the reorder ──
    // The DOM still shows the pre-reorder layout (Svelte batches updates),
    // so the rects match exactly what the user sees right now.
    updateStackHover();

    if (stackHoverId) {
      // Pointer is inside a card's stack zone → suppress the reorder so
      // the target card doesn't slide away from under the cursor.
      // svelte-dnd-action will keep firing consider; we keep saying "no"
      // until the pointer leaves the stack zone.
      return; // ← dndItems is NOT updated → no visual reorder
    }

    // ── Pointer-based insertion (the pointer beats the clone's center) ──
    // The lib's OVER_INDEX indices come from the floating clone's CENTER,
    // which crosses a card's midpoint BEFORE the pointer is over that card
    // (worse the further the grab point is from the card's center) —
    // applying those verbatim made receivers hop to the far side of the
    // cursor on every approach. Instead, insert the shadow only where the
    // pointer itself has reached; "unchanged" declines the reorder, so the
    // receiving card stays exactly where the user sees it.
    if (
      info.trigger === TRIGGERS.DRAGGED_OVER_INDEX ||
      info.trigger === TRIGGERS.DRAGGED_ENTERED
    ) {
      const shadowIdx = dndItems.findIndex((i) => i.isDndShadowItem);
      const zone = zoneEl;
      const zoneRect = zone?.getBoundingClientRect();
      // Shadow re-entering the zone, or the pointer is vertically off the
      // strip → take the lib's order verbatim.
      if (
        shadowIdx === -1 ||
        !zone ||
        !zoneRect ||
        pointer.y < zoneRect.top ||
        pointer.y > zoneRect.bottom
      ) {
        dndItems = next;
        return;
      }
      const centers: number[] = [];
      for (let i = 0; i < zone.children.length; i++) {
        const c = zone.children[i] as HTMLElement;
        // offsetLeft/offsetWidth ignore FLIP transforms → stable mid-shuffle.
        centers.push(c.offsetLeft + c.offsetWidth / 2);
      }
      const domIndex = pointerInsertIndex(pointer.x - zoneRect.left, centers);
      const { insertAt, unchanged } = shadowInsertAt(domIndex, shadowIdx);
      if (unchanged) return;
      const shadow = dndItems[shadowIdx];
      const rest = dndItems.filter((i) => !i.isDndShadowItem);
      const reordered = [...rest.slice(0, insertAt), shadow, ...rest.slice(insertAt)];
      if (reordered.some((it, i) => it !== dndItems[i])) dndItems = reordered;
      return;
    }

    // ── Everything else (left the zone / dropped outside) applies verbatim ──
    dndItems = next;
  }

  function arraysEqual(a: string[], b: string[]) {
    return a.length === b.length && a.every((v, i) => b[i] === v);
  }

  function handleFinalize(e: CustomEvent<DndEvent<StripItem>>) {
    const { items: next } = e.detail;
    window.removeEventListener("pointermove", onPointerMove);
    if (hoverRaf) {
      cancelAnimationFrame(hoverRaf);
      hoverRaf = 0;
    }
    // Refresh from the FINAL pointer position, so the drop lands on the
    // card actually under the cursor at release.
    updateStackHover();
    const source = dragSource;
    const stackTarget = stackHoverId;
    draggingId = null;
    dragSource = null;
    stackHoverId = null;

    const clean = next.filter((i) => !i.isDndShadowItem);
    const base = args.baseItems();

    // While filtering, dragging is disabled — restore visuals and bail.
    if (args.filtering() || !source) {
      dndItems = base;
      return;
    }

    // Center drop → stack the dragged whole onto the target slide.
    if (stackTarget) {
      dndItems = base; // revert the reorder preview
      const sourceIds = args.resolveSourceIds(source.slides[0].id);
      if (sourceIds.length > 0 && !sourceIds.includes(stackTarget)) {
        args.onStack(sourceIds, stackTarget);
      }
      return;
    }

    const nextIds = clean.flatMap((i) => i.slides.map((s) => s.id));
    const prevIds = base.flatMap((i) => i.slides.map((s) => s.id));

    if (arraysEqual(nextIds, prevIds)) {
      dndItems = base;
      return;
    }

    // Optimistic reorder + rollback on mutation error.
    const prevOrdered = args.ordered();
    dndItems = clean;
    args.setOrdered(
      nextIds
        .map((id) => prevOrdered.find((s) => s.id === id))
        .filter((s): s is Slide => Boolean(s)),
    );
    args.onReorder(nextIds, {
      onError: () => {
        args.setOrdered(prevOrdered);
      },
    });
  }

  return {
    get items() {
      return dndItems;
    },
    get draggingId() {
      return draggingId;
    },
    get stackHoverId() {
      return stackHoverId;
    },
    get zoneEl() {
      return zoneEl;
    },
    set zoneEl(el: HTMLElement | undefined) {
      zoneEl = el;
    },
    handleConsider,
    handleFinalize,
  };
}
