/**
 * Slide-strip drag state (svelte-dnd-action) — the reactive controller.
 * Pure decisions live next door: stack-hover-geometry.ts (hit zones with
 * hysteresis), pointer-insertion.ts (pointer-based shadow placement),
 * dnd-finalize.ts (drop commit decision).
 *
 * While the pointer sits inside a stack zone, consider-events are NOT
 * applied, so the receiver card can't slide out from under the cursor.
 */
import { untrack } from "svelte";
import { TRIGGERS, SOURCES, type DndEvent } from "svelte-dnd-action";
import { pointerInsertIndex } from "$lib/lib/stack-targeting";
import type { Slide } from "$lib/types";
import type { StripItem } from "../slide-strip-state.svelte";
import { findStackHoverId } from "./stack-hover-geometry";
import { pointerShadowReorder, shadowIndexOf } from "./pointer-insertion";
import { decideFinalize } from "./dnd-finalize";
import type { StackHoverElement } from "./dnd-types";

const DRAGGED_CLONE_SELECTOR = "#dnd-action-dragged-el";

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

  /** Snapshot the stackable cards on the strip for the pure hit test. */
  function stackHoverElements(): StackHoverElement[] {
    const els = document.querySelectorAll<HTMLElement>("[data-stack-card]");
    const out: StackHoverElement[] = [];
    for (const el of els) {
      // Ignore the lib-generated dragged clone (never a valid target).
      if (el.closest(DRAGGED_CLONE_SELECTOR)) continue;
      const id = el.getAttribute("data-stack-card");
      if (!id) continue;
      out.push({
        id,
        section: el.dataset.stackSection?.trim() || null,
        rect: el.getBoundingClientRect(),
      });
    }
    return out;
  }

  let hoverRaf = 0;
  function updateStackHover() {
    if (!draggingId || !dragSource) {
      stackHoverId = null;
      return;
    }
    stackHoverId = findStackHoverId({
      pointer,
      draggingIds: new Set(dragSource.slides.map((s) => s.id)),
      draggedSection: dragSource.slides[0]?.sectionId?.trim() || null,
      currentHoverId: stackHoverId,
      elements: stackHoverElements(),
    });
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
    if (
      info.trigger === TRIGGERS.DRAGGED_OVER_INDEX ||
      info.trigger === TRIGGERS.DRAGGED_ENTERED
    ) {
      const shadowIdx = shadowIndexOf(dndItems);
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
      const reordered = pointerShadowReorder(dndItems, domIndex);
      if (reordered) dndItems = reordered;
      return;
    }

    // ── Everything else (left the zone / dropped outside) applies verbatim ──
    dndItems = next;
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

    const base = args.baseItems();
    const decision = decideFinalize({
      items: next,
      baseItems: base,
      filtering: args.filtering(),
      hasSource: Boolean(source),
      stackTargetId: stackTarget,
    });

    switch (decision.kind) {
      case "restore":
      case "noop":
        dndItems = base;
        return;

      case "stack": {
        dndItems = base; // revert the reorder preview
        const sourceIds = args.resolveSourceIds(source!.slides[0].id);
        if (sourceIds.length > 0 && !sourceIds.includes(decision.targetId)) {
          args.onStack(sourceIds, decision.targetId);
        }
        return;
      }

      case "reorder": {
        // Optimistic reorder + rollback on mutation error.
        const prevOrdered = args.ordered();
        dndItems = next.filter((i) => !i.isDndShadowItem);
        args.setOrdered(
          decision.nextIds
            .map((id) => prevOrdered.find((s) => s.id === id))
            .filter((s): s is Slide => Boolean(s)),
        );
        args.onReorder(decision.nextIds, {
          onError: () => {
            args.setOrdered(prevOrdered);
          },
        });
        return;
      }
    }
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
