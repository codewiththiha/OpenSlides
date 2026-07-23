<script lang="ts">
  /**
   * Horizontal slide strip.
   *
   *  - `dndzone` (svelte-dnd-action) over VISIBLE items: one item per single
   *    slide / collapsed stack / fanned-out stack wrapper. Reorders map back
   *    to chunk-level arrayMove over the underlying slide order.
   *  - Stack drops are detected with a pointer tracker: rect-math hit zones
   *    on data-stack-card wrappers (data-stack-target overlays are pure
   *    feedback) — "center means stack, edges mean reorder". While the
   *    pointer sits inside a stack zone, consider-events are NOT applied,
   *    so the receiver card can't slide out from under the cursor
   *    (svelte-dnd-action keeps re-firing, we keep declining until the
   *    pointer leaves the zone). Reorders that DO apply are placed by the
   *    POINTER (lib/stack-targeting), not by the dragged clone's center —
   *    otherwise the center crosses a card's midpoint while the pointer is
   *    still short of it and the receiver keeps hopping to the far side of
   *    the cursor.
   *  - The dragged clone (lib-generated) provides the drag preview; a
   *    dashed shadow placeholder marks the insertion slot (bounded FLIP of
   *    the rest).
   */
  import { untrack } from "svelte";
  import { dndzone } from "svelte-dnd-action";
  import { flip } from "svelte/animate";
  import { Plus } from "@lucide/svelte";
  import { SvelteSet } from "svelte/reactivity";
  import { resolveProjectLanguage, type Project, type Slide } from "$lib/types";
  import { createSlideStripState, type StripItem } from "./slide-strip-state.svelte";
  import { createSlideStripDnd } from "./slide-dnd.svelte";
  import { createSlideStripSearch } from "@/features/slides/slide-search.svelte";
  import { createRenameState } from "$lib/lib/rename-state.svelte";
  import { createAddSlide } from "@/features/slides/add-slide.svelte";
  import {
    createSlideDeleter,
    createSlideDuplicator,
    createSlideReorderer,
    createSlideStackActions,
  } from "@/features/slides/slide-actions.svelte";
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
  import { autoDissolveStacks } from "$lib/lib/stacking.svelte";
  import { updateSlideSettingsMutation } from "$lib/queries";
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

  const FLIP_MS = 150;

  const isCollapsed = $derived(collapsed ?? ui.isBottomPanelCollapsed);

  // Stable per mount (the panel lives under the project-keyed EditorInner) —
  // untrack() marks the one-time id capture shared by the factories below.
  const projectId = untrack(() => project.id);

  const addSlideMut = createAddSlide(projectId, () => project);
  const duplicateSlide = createSlideDuplicator(projectId);
  const reorderSlides = createSlideReorderer(projectId);
  const { stackSlides, unstackSlides } = createSlideStackActions(projectId);
  const updateSettings = updateSlideSettingsMutation(projectId);
  const theme = $derived(project.theme);
  const language = $derived(resolveProjectLanguage(project));

  autoDissolveStacks(
    () => project.slides,
    (s) => s.sectionId,
    (s) => s.id,
    unstackSlides,
  );



  const search = createSlideStripSearch({
    projectId,
    ordered: () => strip.ordered,
  });
  const searchQuery = $derived(search.searchQuery);
  const filteredOrdered = $derived(search.filteredOrdered);

  const strip = createSlideStripState({
    slides: () => project.slides,
    filteredOrdered: () => filteredOrdered,
  });
  const dnd = createSlideStripDnd({
    baseItems: () => strip.baseItems,
    filtering: () => searchQuery.trim().length > 0,
    resolveSourceIds,
    ordered: () => strip.ordered,
    setOrdered: (slides) => (strip.ordered = slides),
    onStack: stackSlides,
    onReorder: (ids, opts) => reorderSlides(ids, opts),
  });

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

  const rename = createRenameState(async (id: string, name: string) => {
    const finalName = name || "Untitled slide";
    await new Promise<void>((resolve) => {
      updateSettings.mutate(
        { slideId: id, payload: { name: finalName } },
        {
          onSuccess: () => {
            strip.ordered = strip.ordered.map((s) => (s.id === id ? { ...s, name: finalName } : s));
            resolve();
          },
          onError: () => resolve(),
        },
      );
    });
  });

  const deleter = createSlideDeleter(projectId, {
    ordered: () => strip.ordered,
    renamingId: () => rename.renamingId,
    pendingFocusId: strip.pendingFocusId,
  });



  /**
   * A visible card maps to its whole slide section, even when the visible
   * card is just the first member (or a lone member).
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

  /* ----------------------- Selection / menu actions ---------------------- */
  const selectedInOrder = () =>
    strip.ordered.filter((slide) => selectedSlideIds.has(slide.id)).map((slide) => slide.id);

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
    for (const slide of strip.ordered) selectedSlideIds.add(slide.id);
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
    const remaining = strip.ordered.filter((slide) => !selectedSet.has(slide.id)).map((slide) => slide.id);
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
    if (!selected.length || selected.length >= strip.ordered.length) return;
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

</script>

{#snippet stackTargetOverlay(targetId: string, ownerItemId: string)}
  <!-- Hit testing lives in updateStackHover() (rect math) — this element is
       pure feedback, so it never intercepts the dnd zone's pointer events. -->
  {@const isDraggingOther = dnd.draggingId !== null && dnd.draggingId !== ownerItemId}
  <div
    data-stack-target={targetId}
    class={cn(
      "pointer-events-none absolute inset-x-[16%] inset-y-[12%] z-30 rounded-lg border-2 border-dashed transition-all duration-150",
      isDraggingOther ? "opacity-100" : "opacity-0",
      dnd.stackHoverId === targetId
        ? "scale-[1.03] border-solid border-primary bg-primary/20 shadow-lg ring-2 ring-primary ring-offset-1 ring-offset-background"
        : "border-primary/40 bg-primary/[0.05]",
    )}
  ></div>
{/snippet}

{#snippet cardFor(slide: Slide)}
  <SlideCard
    {slide}
    index={strip.originalIndex(slide.id)}
    isRenaming={rename.renamingId === slide.id}
    renameValue={rename.renamingId === slide.id ? rename.value : ""}
    highlightProgress={activeHighlightIndex}
    onRenameValueChange={(v) => (rename.value = v)}
    onCommitRename={() => void rename.commit()}
    onCancelRename={rename.cancel}
    onRemove={handleRemove}
    onRename={rename.start}
    onDuplicate={handleDuplicate}
    registerCardRef={strip.registerCardRef}
    cardRefs={strip.cardRefs}
    navigationIds={strip.navIds}
    isTabStop={slide.id === strip.tabStopId}
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
    {#each strip.ordered as slide, index (slide.id)}
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
      onclick={() => void addSlideMut.addSlide()}
      disabled={addSlideMut.isPending}
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
        bind:this={dnd.zoneEl}
        class="relative flex min-h-0 shrink-0 items-center gap-2"
        role="listbox"
        aria-label="Slides"
        use:dndzone={{
          items: dnd.items,
          flipDurationMs: FLIP_MS,
          dragDisabled: Boolean(searchQuery.trim()) || rename.renamingId !== null,
          type: "slide-strip",
          dropTargetStyle: {},
          zoneItemTabIndex: -1,
          zoneTabIndex: -1,
          morphDisabled: true,
        }}
        onconsider={dnd.handleConsider}
        onfinalize={dnd.handleFinalize}
      >
        {#each dnd.items as item (item.id)}
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
                    strip.expandedSectionId = null;
                  }}
                  onClose={() => (strip.expandedSectionId = null)}
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
                  onExpand={() => (strip.expandedSectionId = item.groupId)}
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
        onclick={() => void addSlideMut.addSlide()}
        disabled={addSlideMut.isPending}
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
      totalSlides={strip.ordered.length}
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
