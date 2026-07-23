<script lang="ts">
  /**
   * Horizontal slide strip (Svelte 5 port).
   *
   * React rendered a @dnd-kit DndContext + SortableContext over ALL slide ids
   * with per-chunk sortable items, center-only stack drop targets, and a
   * DragOverlay clone. Here:
   *  - `dndzone` (svelte-dnd-action) over VISIBLE items: one item per single
   *    slide / collapsed stack / fanned-out stack wrapper. Reorders map back
   *    to chunk-level arrayMove exactly like the React version.
   *  - Stack drops are detected with a pointer tracker: rect-math hit zones
   *    on data-stack-card wrappers (data-stack-target overlays are pure
   *    feedback) — same "center means stack, edges mean reorder" rule as
   *    the dnd-kit droppables. While the pointer sits inside a stack zone,
   *    consider-events are NOT applied, so the receiver card can't slide
   *    out from under the cursor (svelte-dnd-action keeps re-firing, we
   *    keep declining until the pointer leaves the zone). Reorders that DO
   *    apply are placed by the POINTER (lib/stack-targeting), not by the
   *    clone's center — otherwise the center crosses a card's midpoint
   *    while the pointer is still short of it and the receiver keeps
   *    hopping to the far side of the cursor.
   *  - The dragged clone (lib-generated) replaces DragOverlay; a dashed
   *    shadow placeholder marks the insertion slot (bounded FLIP of the rest).
   */
  import { untrack } from "svelte";
  import {
    dndzone,
    TRIGGERS,
    SOURCES,
    type DndEvent,
  } from "svelte-dnd-action";
  import { flip } from "svelte/animate";
  import { Plus } from "@lucide/svelte";
  import { SvelteSet } from "svelte/reactivity";
  import { resolveProjectLanguage, type Project, type Slide } from "$lib/types";
  import { pointerInsertIndex, shadowInsertAt } from "$lib/lib/stack-targeting";
  import { useSlideStripSearch } from "@/hooks/useSlideStripSearch.svelte";
  import { useInlineRename } from "@/hooks/useInlineRename.svelte";
  import { useAddSlide } from "@/hooks/useAddSlide.svelte";
  import {
    useDeleteSlideWithUndo,
    useDuplicateSlide,
    useReorderSlides,
    useStackSlides,
  } from "@/hooks/useSlideActions.svelte";
  import SlideCard, { ITEM_HEIGHT, ITEM_WIDTH } from "@/features/slides/SlideCard.svelte";
  import SlideSearchDialog, { type SearchScope } from "@/features/slides/SlideSearchDialog.svelte";
  import SlideContextMenu from "@/features/slides/SlideContextMenu.svelte";
  import SlideSelectionToolbar from "@/features/slides/SlideSelectionToolbar.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import StackExpandedControls from "$lib/ui/stack/StackExpandedControls.svelte";
  import StackDeck from "$lib/ui/stack/StackDeck.svelte";
  import {
    ui,
    setCurrentSlideId,
    setIsBottomPanelCollapsed,
  } from "$lib/stores/ui-state.svelte";
  import { chunkConsecutive } from "$lib/lib/grouping";
  import { useAutoDissolveStacks } from "@/hooks/useAutoDissolveStacks.svelte";
  import { useUpdateSlideSettings } from "$lib/queries";
  import { isTypingTarget } from "$lib/lib/keyboard";
  import { cn } from "$lib/lib/utils";

  let {
    project,
    collapsed,
    activeHighlightIndex = -1,
  }: {
    project: Project;
    collapsed?: boolean;
    activeHighlightIndex?: number;
  } = $props();

  interface StripItem {
    id: string;
    slides: Slide[];
    groupId: string | null;
    /** Whole section fanned out inside one wrapper item. */
    expanded: boolean;
    isDndShadowItem?: boolean;
  }

  const FLIP_MS = 150;
  const DRAGGED_CLONE_SELECTOR = "#dnd-action-dragged-el";

  /* Stack targeting geometry — fractions of a card rect.
     ENTER = visible dashed zone; EXIT = larger "stay" region so pointer
     jitter near the edge doesn't drop the target (hysteresis). */
  const STACK_ENTER_X = 0.16;
  const STACK_ENTER_Y = 0.12;
  const STACK_EXIT_X = 0.05;
  const STACK_EXIT_Y = 0.04;

  const isCollapsed = $derived(collapsed ?? ui.isBottomPanelCollapsed);

  // Stable per mount (the panel lives under the project-keyed EditorInner) —
  // untrack() marks the one-time id capture shared by the hooks below.
  const projectId = untrack(() => project.id);

  const addSlideHook = useAddSlide(projectId, () => project);
  const duplicateSlide = useDuplicateSlide(projectId);
  const reorderSlides = useReorderSlides(projectId);
  const { stackSlides, unstackSlides } = useStackSlides(projectId);
  const updateSettings = useUpdateSlideSettings(projectId);
  const theme = $derived(project.theme);
  const language = $derived(resolveProjectLanguage(project));

  useAutoDissolveStacks(
    () => project.slides,
    (s) => s.sectionId,
    (s) => s.id,
    unstackSlides,
  );

  let expandedSectionId = $state<string | null>(null);

  /* Local working copy of the slide order (React's `ordered` state): keeps
   * optimistic reorders/renames while the query cache catches up. */
  let ordered = $state<Slide[]>([]);
  $effect(() => {
    const src = project.slides;
    untrack(() => {
      if (
        ordered.length !== src.length ||
        src.some((s, i) => ordered[i] !== s)
      ) {
        ordered = src;
      }
    });
  });

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

  const search = useSlideStripSearch({
    projectId,
    ordered: () => ordered,
  });
  const searchQuery = $derived(search.searchQuery);
  const filteredOrdered = $derived(search.filteredOrdered);

  const selectedSlideIds = new SvelteSet<string>();
  let isMultiSelectMode = $state(false);
  let contextMenu = $state<{
    slide: Slide;
    title: string;
    position: { x: number; y: number };
  } | null>(null);
  let confirmBulkDelete = $state(false);
  let isSearchDialogOpen = $state(false);
  let searchScope = $state<SearchScope>("slides");
  let searchDialogQuery = $state("");

  $effect(() => {
    const openSearch = () => {
      if (ui.isBottomPanelCollapsed) setIsBottomPanelCollapsed(false);
      searchScope = "slides";
      searchDialogQuery = search.rawSearchQuery;
      isSearchDialogOpen = true;
    };
    window.addEventListener("openslides:open-search", openSearch);
    return () => window.removeEventListener("openslides:open-search", openSearch);
  });

  const rename = useInlineRename(async (id: string, name: string) => {
    const finalName = name || "Untitled slide";
    await new Promise<void>((resolve) => {
      updateSettings.mutate(
        { slideId: id, payload: { name: finalName } },
        {
          onSuccess: () => {
            ordered = ordered.map((s) => (s.id === id ? { ...s, name: finalName } : s));
            resolve();
          },
          onError: () => resolve(),
        },
      );
    });
  });

  const deleter = useDeleteSlideWithUndo(projectId, {
    ordered: () => ordered,
    renamingId: () => rename.renamingId,
    pendingFocusId,
  });

  const slideChunks = $derived(chunkConsecutive(filteredOrdered));
  const navIds = $derived(filteredOrdered.map((s) => s.id));
  const tabStopId = $derived(
    filteredOrdered.find((s) => s.id === ui.currentSlideId)?.id ?? filteredOrdered[0]?.id,
  );

  /* ------------------------ DnD (svelte-dnd-action) ---------------------- */
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

  let dndItems = $state<StripItem[]>([]);
  let draggingId = $state<string | null>(null);
  let stackHoverId = $state<string | null>(null);
  /** Payload of the dragged item, snapshotted at DRAG_STARTED. */
  let dragSource: StripItem | null = null;
  const pointer = { x: 0, y: 0 };
  let zoneEl = $state<HTMLElement | undefined>(undefined);

  $effect(() => {
    const base = baseItems;
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

  /**
   * React's resolveSourceIds: a visible card maps to its whole slide section,
   * even when the visible card is just the first member (or a lone member).
   */
  function resolveSourceIds(activeId: string): string[] {
    const slide = project.slides.find((s) => s.id === activeId);
    const sectionId = slide?.sectionId?.trim();
    return sectionId
      ? project.slides
          .filter((s) => s.sectionId?.trim() === sectionId)
          .map((s) => s.id)
      : [activeId];
  }

  function handleFinalize(e: CustomEvent<DndEvent<StripItem>>) {
    const { items: next } = e.detail;
    window.removeEventListener("pointermove", onPointerMove);
    if (hoverRaf) {
      cancelAnimationFrame(hoverRaf);
      hoverRaf = 0;
    }
    // Refresh from the FINAL pointer position, so the drop lands on the
    // card actually under the cursor at release (dnd-kit parity).
    updateStackHover();
    const source = dragSource;
    const stackTarget = stackHoverId;
    draggingId = null;
    dragSource = null;
    stackHoverId = null;

    const clean = next.filter((i) => !i.isDndShadowItem);

    // While filtering, dragging is disabled — restore visuals and bail.
    if (searchQuery.trim() || !source) {
      dndItems = baseItems;
      return;
    }

    // Center drop → stack the dragged whole onto the target slide.
    if (stackTarget) {
      dndItems = baseItems; // revert the reorder preview
      const sourceIds = resolveSourceIds(source.slides[0].id);
      if (sourceIds.length > 0 && !sourceIds.includes(stackTarget)) {
        stackSlides(sourceIds, stackTarget);
      }
      return;
    }

    const nextIds = clean.flatMap((i) => i.slides.map((s) => s.id));
    const prevIds = baseItems.flatMap((i) => i.slides.map((s) => s.id));

    if (arraysEqual(nextIds, prevIds)) {
      dndItems = baseItems;
      return;
    }

    // Optimistic reorder + rollback (React's setOrdered + onError restore).
    const prevOrdered = ordered;
    dndItems = clean;
    ordered = nextIds
      .map((id) => ordered.find((s) => s.id === id))
      .filter((s): s is Slide => Boolean(s));
    reorderSlides(nextIds, {
      onError: () => {
        ordered = prevOrdered;
      },
    });
  }

  /* ----------------------- Selection / menu actions ---------------------- */
  const selectedInOrder = () =>
    ordered.filter((slide) => selectedSlideIds.has(slide.id)).map((slide) => slide.id);

  function toggleSlideSelection(id: string, position?: { x: number; y: number }) {
    if (selectedSlideIds.has(id)) selectedSlideIds.delete(id);
    else selectedSlideIds.add(id);
    if (position && contextMenu) {
      contextMenu = { ...contextMenu, position };
    }
  }

  const closeContextMenu = () => (contextMenu = null);

  function openContextMenu(event: MouseEvent, slide: Slide, title: string) {
    setCurrentSlideId(slide.id);
    if (isMultiSelectMode) {
      toggleSlideSelection(slide.id);
      return;
    }
    contextMenu = { slide, title, position: { x: event.clientX, y: event.clientY } };
  }

  function startMultiSelect() {
    if (!contextMenu) return;
    isMultiSelectMode = true;
    selectedSlideIds.clear();
    selectedSlideIds.add(contextMenu.slide.id);
    closeContextMenu();
  }

  function selectAllSlides() {
    isMultiSelectMode = true;
    selectedSlideIds.clear();
    for (const slide of ordered) selectedSlideIds.add(slide.id);
    closeContextMenu();
  }

  function clearSlideSelection() {
    selectedSlideIds.clear();
    isMultiSelectMode = false;
    closeContextMenu();
  }

  function changeSearchScope(scope: SearchScope) {
    searchScope = scope;
    if (scope === "code") search.clearSearch();
    else search.rawSearchQuery = searchDialogQuery;
  }

  function changeSearchQuery(value: string) {
    searchDialogQuery = value;
    if (searchScope === "slides") search.rawSearchQuery = value;
  }

  function submitCodeSearch() {
    window.dispatchEvent(
      new CustomEvent("openslides:find-in-code", { detail: { query: searchDialogQuery } }),
    );
    isSearchDialogOpen = false;
  }

  // Reserve the bottom-right toast slot for the batch-action bubbles. The
  // toaster moves above it only while a multi-selection is active.
  $effect(() => {
    const root = document.documentElement;
    root.toggleAttribute("data-slide-selection-active", isMultiSelectMode);
    return () => root.removeAttribute("data-slide-selection-active");
  });

  function moveSelected(destination: "start" | "end") {
    const selected = selectedInOrder();
    if (!selected.length) return;
    const selectedSet = new Set(selected);
    const remaining = ordered.filter((slide) => !selectedSet.has(slide.id)).map((slide) => slide.id);
    reorderSlides(destination === "start" ? [...selected, ...remaining] : [...remaining, ...selected]);
    closeContextMenu();
  }

  function groupSelected() {
    const selected = selectedInOrder();
    if (selected.length < 2) return;
    stackSlides(selected.slice(1), selected[0], {
      onSuccess: () => {
        selectedSlideIds.clear();
        for (const id of selected) selectedSlideIds.add(id);
      },
    });
    closeContextMenu();
  }

  function deleteSelected() {
    const selected = selectedInOrder();
    if (!selected.length || selected.length >= ordered.length) return;
    confirmBulkDelete = true;
    closeContextMenu();
  }

  // Keyboard batch actions remain available even when the right-click menu is gone.
  $effect(() => {
    if (!isMultiSelectMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // A confirmation dialog is a higher-priority escape target. Let its
      // overlay consume Escape first; keep the selection toolbar intact.
      if (confirmBulkDelete) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        clearSlideSelection();
        return;
      }
      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isTypingTarget(event.target)
      ) {
        event.preventDefault();
        event.stopPropagation();
        deleteSelected();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  });

  function confirmDeleteSelected() {
    const selected = selectedInOrder();
    confirmBulkDelete = false;
    void (async () => {
      const result = await deleter.deleteSlides(selected);
      if (result.ok) {
        selectedSlideIds.clear();
        isMultiSelectMode = false;
        return;
      }
      // Keep any slides that were not deleted selected so the user can retry
      // or choose another bulk action without losing context.
      for (const id of [...selectedSlideIds]) {
        if (result.deletedIds.has(id)) selectedSlideIds.delete(id);
      }
    })();
  }

  const handleRemove = deleter.deleteSlideWithUndo;
  const handleDuplicate = duplicateSlide;

  function originalIndex(slideId: string) {
    const i = ordered.findIndex((s) => s.id === slideId);
    return i >= 0 ? i : 0;
  }
</script>

{#snippet stackTargetOverlay(targetId: string, ownerItemId: string)}
  <!-- Hit testing lives in updateStackHover() (rect math) — this element is
       pure feedback, so it never intercepts the dnd zone's pointer events. -->
  {@const isDraggingOther = draggingId !== null && draggingId !== ownerItemId}
  <div
    data-stack-target={targetId}
    class={cn(
      "pointer-events-none absolute inset-x-[16%] inset-y-[12%] z-30 rounded-lg border-2 border-dashed transition-all duration-150",
      isDraggingOther ? "opacity-100" : "opacity-0",
      stackHoverId === targetId
        ? "scale-[1.03] border-solid border-primary bg-primary/20 shadow-lg ring-2 ring-primary ring-offset-1 ring-offset-background"
        : "border-primary/40 bg-primary/[0.05]",
    )}
  ></div>
{/snippet}

{#snippet cardFor(slide: Slide)}
  <SlideCard
    {slide}
    index={originalIndex(slide.id)}
    isRenaming={rename.renamingId === slide.id}
    renameValue={rename.renamingId === slide.id ? rename.value : ""}
    highlightProgress={activeHighlightIndex}
    onRenameValueChange={(v) => (rename.value = v)}
    onCommitRename={() => void rename.commit()}
    onCancelRename={rename.cancel}
    onRemove={handleRemove}
    onRename={rename.start}
    onDuplicate={handleDuplicate}
    registerCardRef={registerCardRef}
    cardRefs={cardRefs}
    navigationIds={navIds}
    isTabStop={slide.id === tabStopId}
    {isMultiSelectMode}
    isMultiSelected={selectedSlideIds.has(slide.id)}
    onToggleMultiSelect={toggleSlideSelection}
    onOpenContextMenu={openContextMenu}
    {theme}
    {language}
    {searchQuery}
    enableHoverPreview={ui.showSlideHoverPreview}
  />
{/snippet}

{#snippet shadowPlaceholder(item: StripItem)}
  <div
    class="shrink-0 rounded-md border-2 border-dashed border-primary/50 bg-primary/10 self-center"
    style="width: {item.expanded
      ? item.slides.length * (ITEM_WIDTH + 8) + 96
      : ITEM_WIDTH}px; height: {ITEM_HEIGHT}px;"
  ></div>
{/snippet}

{#if isCollapsed}
  <div
    class="flex h-full min-h-[36px] items-stretch overflow-x-auto border-y border-border/50 bg-card/60"
  >
    {#each ordered as slide, index (slide.id)}
      <button
        type="button"
        onclick={() => setCurrentSlideId(slide.id)}
        class={cn(
          "flex h-full min-w-11 shrink-0 items-center justify-center border-r border-border/60 px-3 text-sm font-bold tabular-nums transition-colors",
          ui.currentSlideId === slide.id
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        )}
        title="Slide {index + 1}"
      >
        {index + 1}
      </button>
    {/each}
    <button
      type="button"
      onclick={() => void addSlideHook.addSlide()}
      disabled={addSlideHook.isPending}
      class="flex h-full min-w-11 shrink-0 items-center justify-center px-3 text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary disabled:opacity-50"
      title="Add slide"
    >
      <Plus class="h-4 w-4" />
    </button>
  </div>
{:else}
  <div class="flex h-full min-h-[140px] min-w-0 flex-col bg-card/60">
    <div
      class="flex min-h-0 flex-1 items-center gap-2 overflow-x-auto overflow-y-hidden px-3 py-1"
      style="touch-action: pan-x;"
    >
      <!-- The zone must contain ONLY item children (the lib pairs children to
           items by index), so the add-slide button lives outside it. -->
      <div
        bind:this={zoneEl}
        class="relative flex min-h-0 shrink-0 items-center gap-2"
        role="listbox"
        aria-label="Slides"
        use:dndzone={{
          items: dndItems,
          flipDurationMs: FLIP_MS,
          dragDisabled: Boolean(searchQuery.trim()) || rename.renamingId !== null,
          type: "slide-strip",
          dropTargetStyle: {},
          zoneItemTabIndex: -1,
          zoneTabIndex: -1,
          morphDisabled: true,
        }}
        onconsider={handleConsider}
        onfinalize={handleFinalize}
      >
        {#each dndItems as item (item.id)}
          <div animate:flip={{ duration: FLIP_MS }} class="relative shrink-0">
            {#if item.isDndShadowItem}
              {@render shadowPlaceholder(item)}
            {:else if item.expanded}
              <div
                class="flex min-h-[132px] items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-2 py-1 transition-all duration-200"
              >
                <StackExpandedControls
                  count={item.slides.length}
                  variant="slide-strip"
                  onUngroup={() => {
                    unstackSlides(item.slides.map((s) => s.id));
                    expandedSectionId = null;
                  }}
                  onClose={() => (expandedSectionId = null)}
                />
                {#each item.slides as slide (slide.id)}
                  <div
                    class="relative shrink-0"
                    data-stack-card={slide.id}
                    data-stack-section={slide.sectionId?.trim() ?? ""}
                  >
                    {@render stackTargetOverlay(slide.id, item.id)}
                    {@render cardFor(slide)}
                  </div>
                {/each}
              </div>
            {:else if item.slides.length > 1}
              <div
                class="relative shrink-0"
                data-stack-card={item.slides[0].id}
                data-stack-section={item.slides[0].sectionId?.trim() ?? ""}
              >
                {@render stackTargetOverlay(item.slides[0].id, item.id)}
                <StackDeck
                  count={item.slides.length}
                  variant="slide"
                  class="shrink-0"
                  style="height: {ITEM_HEIGHT}px;"
                  onExpand={() => (expandedSectionId = item.groupId)}
                  onOpenTop={() => setCurrentSlideId(item.slides[0].id)}
                >
                  {@render cardFor(item.slides[0])}
                </StackDeck>
              </div>
            {:else}
              <div
                class="relative shrink-0"
                data-stack-card={item.slides[0].id}
                data-stack-section={item.slides[0].sectionId?.trim() ?? ""}
              >
                {@render stackTargetOverlay(item.slides[0].id, item.id)}
                {@render cardFor(item.slides[0])}
              </div>
            {/if}
          </div>
        {/each}
      </div>
      <button
        type="button"
        onclick={() => void addSlideHook.addSlide()}
        disabled={addSlideHook.isPending}
        class="grid h-[132px] w-[152px] shrink-0 place-items-center self-center rounded-md border border-dashed border-border/80 bg-card/30 text-muted-foreground transition-all hover:border-primary/60 hover:bg-primary/5 hover:text-primary disabled:pointer-events-none disabled:opacity-50"
        title="Add slide"
      >
        <Plus class="h-7 w-7 stroke-[1.35]" />
      </button>
    </div>

    <SlideSearchDialog
      open={isSearchDialogOpen}
      query={searchDialogQuery}
      scope={searchScope}
      onQueryChange={changeSearchQuery}
      onScopeChange={changeSearchScope}
      onSubmitCodeSearch={submitCodeSearch}
      onClose={() => {
        isSearchDialogOpen = false;
        if (searchScope === "code") searchDialogQuery = "";
      }}
    />

    <SlideContextMenu
      open={contextMenu !== null}
      position={contextMenu?.position ?? { x: 0, y: 0 }}
      onRename={() => {
        if (contextMenu) rename.start(contextMenu.slide.id, contextMenu.title);
        closeContextMenu();
      }}
      onStartSelection={startMultiSelect}
      onSelectAll={selectAllSlides}
      onClose={closeContextMenu}
    />

    <SlideSelectionToolbar
      open={isMultiSelectMode}
      selectionCount={selectedSlideIds.size}
      totalSlides={ordered.length}
      onMoveToStart={() => moveSelected("start")}
      onMoveToEnd={() => moveSelected("end")}
      onGroup={groupSelected}
      onDelete={deleteSelected}
      onCancel={clearSlideSelection}
    />

    <ConfirmDialog
      open={confirmBulkDelete}
      title="Delete {selectedSlideIds.size} selected slide{selectedSlideIds.size === 1
        ? ''
        : 's'}?"
      description="This cannot be undone."
      confirmLabel="Delete"
      destructive
      onConfirm={confirmDeleteSelected}
      onCancel={() => (confirmBulkDelete = false)}
    />
  </div>
{/if}
