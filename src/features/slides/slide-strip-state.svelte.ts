/**
 * Slide-strip order state: the optimistic local copy of the slide order,
 * stack-expansion state, roving-focus bookkeeping, and the chunk → strip
 * item projection the dnd zone renders.
 */
import { untrack } from "svelte";
import { ui } from "$lib/stores/ui-state.svelte";
import { chunkConsecutive } from "$lib/lib/grouping";
import type { Slide } from "$lib/types";

export interface StripItem {
  id: string;
  slides: Slide[];
  groupId: string | null;
  /** Whole section fanned out inside one wrapper item. */
  expanded: boolean;
  isDndShadowItem?: boolean;
}

export function createSlideStripState(args: {
  slides: () => Slide[];
  filteredOrdered: () => Slide[];
}) {
  /* Local working copy of the slide order: keeps optimistic reorders/renames
   * while the query cache catches up. */
  let ordered = $state<Slide[]>([]);
  $effect(() => {
    const src = args.slides();
    untrack(() => {
      if (
        ordered.length !== src.length ||
        src.some((s, i) => ordered[i] !== s)
      ) {
        ordered = src;
      }
    });
  });

  let expandedSectionId = $state<string | null>(null);

  /* Roving-focus bookkeeping (plain, non-reactive structures). */
  const cardRefs = new Map<string, HTMLDivElement>();
  const pendingFocusId = { current: null as string | null };

  function registerCardRef(id: string, node: HTMLDivElement | null) {
    if (node) cardRefs.set(id, node);
    else cardRefs.delete(id);
  }

  $effect(() => {
    void ordered;
    const id = pendingFocusId.current;
    if (!id) return;
    untrack(() => {
      const node = cardRefs.get(id);
      if (!node) return;
      node.focus();
      node.scrollIntoView({ inline: "nearest", block: "nearest" });
      pendingFocusId.current = null;
    });
  });

  const slideChunks = $derived(chunkConsecutive(args.filteredOrdered()));
  const navIds = $derived(args.filteredOrdered().map((s) => s.id));
  const tabStopId = $derived(
    args.filteredOrdered().find((s) => s.id === ui.currentSlideId)?.id ??
      args.filteredOrdered()[0]?.id,
  );

  /* Chunk → visible strip items: one per single slide / collapsed stack /
   * fanned-out stack wrapper. */
  const baseItems = $derived.by(() =>
    slideChunks.map((chunk) => {
      const isStack = chunk.kind === "stack" && chunk.items.length > 1;
      const expanded = isStack && chunk.groupId === expandedSectionId;
      return {
        id: isStack ? `stack:${chunk.groupId}` : chunk.items[0].id,
        slides: chunk.items,
        groupId: isStack ? (chunk.groupId ?? null) : null,
        expanded,
      } satisfies StripItem;
    }),
  );

  function originalIndex(slideId: string) {
    const i = ordered.findIndex((s) => s.id === slideId);
    return i >= 0 ? i : 0;
  }

  return {
    get ordered() {
      return ordered;
    },
    set ordered(next: Slide[]) {
      ordered = next;
    },
    get expandedSectionId() {
      return expandedSectionId;
    },
    set expandedSectionId(id: string | null) {
      expandedSectionId = id;
    },
    cardRefs,
    pendingFocusId,
    registerCardRef,
    get slideChunks() {
      return slideChunks;
    },
    get navIds() {
      return navIds;
    },
    get tabStopId() {
      return tabStopId;
    },
    get baseItems() {
      return baseItems;
    },
    originalIndex,
  };
}
