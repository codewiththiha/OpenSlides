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
   *  - Stack drops are detected with a pointer tracker: center-region
   *    overlays (data-stack-target, pointer-events:auto only during drags)
   *    are hit-tested via elementsFromPoint — same "center means stack,
   *    edges mean reorder" rule as the dnd-kit droppables.
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
  import { resolveProjectLanguage, type Project, type Slide } from "@/types";
  import { useSlideStripSearch } from "@/hooks/useSlideStripSearch.svelte";
  import { useInlineRename } from "@/hooks/useInlineRename.svelte";
  import { useAddSlide } from "@/hooks/useAddSlide.svelte";
  import {
    useDeleteSlideWithUndo,
    useDuplicateSlide,
    useReorderSlides,
    useStackSlides,
  } from "@/hooks/useSlideActions.svelte";
  import SlideCard, { ITEM_HEIGHT, ITEM_WIDTH } from "./slides/SlideCard.svelte";
  import SlideSearchDialog, { type SearchScope } from "./slides/SlideSearchDialog.svelte";
  import SlideContextMenu from "./slides/SlideContextMenu.svelte";
  import SlideSelectionToolbar from "./slides/SlideSelectionToolbar.svelte";
  import ConfirmDialog from "./ui/ConfirmDialog.svelte";
  import StackExpandedControls from "./ui/stack/StackExpandedControls.svelte";
  import StackDeck from "./ui/stack/StackDeck.svelte";
  import {
    ui,
    setCurrentSlideId,
    setIsBottomPanelCollapsed,
  } from "@/store/ui-state.svelte";
  import { chunkConsecutive } from "@/lib/grouping";
  import { useAutoDissolveStacks } from "@/hooks/useAutoDissolveStacks.svelte";
  import { useUpdateSlideSettings } from "@/queries";
  import { isTypingTarget } from "@/lib/keyboard";
  import { cn } from "@/lib/utils";

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

  function updateStackHover() {
    if (!draggingId) {
      stackHoverId = null;
      return;
    }
    const hits = document.elementsFromPoint(pointer.x, pointer.y);
    let found: string | null = null;
    for (const el of hits) {
      if (el.id === "dnd-action-dragged-el" || el.closest?.(DRAGGED_CLONE_SELECTOR)) continue;
      const target = el.closest?.("[data-stack-target]");
      if (target) {
        found = target.getAttribute("data-stack-target");
        break;
      }
    }
    stackHoverId = found;
  }

  function onPointerMove(e: PointerEvent) {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    updateStackHover();
  }

  function handleConsider(e: CustomEvent<DndEvent<StripItem>>) {
    const { items: next, info } = e.detail;
    dndItems = next;
    if (info.trigger === TRIGGERS.DRAG_STARTED && info.source === SOURCES.POINTER) {
      draggingId = String(info.id);
      dragSource = dndItems.find((i) => i.id === draggingId) ?? null;
      window.addEventListener("pointermove", onPointerMove);
    }
    if (
      info.trigger === TRIGGERS.DRAGGED_OVER_INDEX ||
      info.trigger === TRIGGERS.DRAGGED_ENTERED ||
      info.trigger === TRIGGERS.DRAGGED_LEFT
    ) {
      // Zone content shifted under a stationary pointer – re-hit-test.
      updateStackHover();
    }
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
  <!-- Center-only target: card edges stay available to the zone's reorder
       hit area, while the center means stack (dnd-kit droppable equivalent). -->
  <div
    data-stack-target={targetId}
    class={cn(
      "absolute inset-x-[24%] inset-y-[20%] z-30 rounded-md transition-all duration-150",
      stackHoverId === targetId
        ? "pointer-events-auto bg-primary/15 shadow-md ring-2 ring-primary ring-offset-1 ring-offset-background"
        : "pointer-events-none",
    )}
    style:pointer-events={draggingId && draggingId !== ownerItemId ? "auto" : "none"}
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
        class="flex min-h-0 shrink-0 items-center gap-2"
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
                  <div class="relative shrink-0">
                    {@render stackTargetOverlay(slide.id, item.id)}
                    {@render cardFor(slide)}
                  </div>
                {/each}
              </div>
            {:else if item.slides.length > 1}
              <div class="relative shrink-0">
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
              <div class="relative shrink-0">
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
