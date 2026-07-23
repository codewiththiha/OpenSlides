<script lang="ts">
  /**
   * Expanded slide strip: dnd zone (single cards, collapsed stack decks,
   * fanned-out stack wrappers), add-slide button, search dialog, context
   * menu, selection toolbar, and the bulk-delete confirmation.
   *
   * Stack-hit feedback overlay: hit testing lives in the dnd controller's
   * pointer tracker (rect math) — data-stack-target elements are pure
   * feedback, so they never intercept pointer events.
   */
  import { untrack } from "svelte";
  import { Plus } from "@lucide/svelte";
  import { setCurrentSlideId, ui } from "$lib/stores/ui-state.svelte";
  import { cn } from "$lib/lib/utils";
  import type { Slide } from "$lib/types";
  import SlideCard, {
    ITEM_HEIGHT,
    ITEM_WIDTH,
  } from "@/features/slides/SlideCard.svelte";
  import StackExpandedControls from "$lib/ui/stack/StackExpandedControls.svelte";
  import StackDeck from "$lib/ui/stack/StackDeck.svelte";
  import SlideSearchDialog from "@/features/slides/SlideSearchDialog.svelte";
  import SlideContextMenu from "@/features/slides/SlideContextMenu.svelte";
  import SlideSelectionToolbar from "@/features/slides/SlideSelectionToolbar.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import SlideStripDndZone from "./SlideStripDndZone.svelte";
  import { provideSlideCardActions } from "../slide-card-actions.svelte";
  import type {
    createSlideStripState,
    StripItem,
  } from "../slide-strip-state.svelte";
  import type { createSlideStripDnd } from "../dnd/slide-dnd.svelte";
  import type { createSlideStripSelection } from "./SlideStripSelectionController.svelte";
  import type { createSlideStripContextMenu } from "./SlideStripContextMenuController.svelte";
  import type { createSlideStripSearchDialog } from "./SlideStripSearchDialogController.svelte";
  import type { createRenameState } from "$lib/lib/rename-state.svelte";

  let {
    strip,
    dnd,
    selection,
    menuCtl,
    searchDlg,
    rename,
    searchQuery,
    theme,
    language,
    activeHighlightIndex,
    onRemove,
    onDuplicate,
    unstackSlides,
    addSlide,
    flipMs,
  }: {
    strip: ReturnType<typeof createSlideStripState>;
    dnd: ReturnType<typeof createSlideStripDnd>;
    selection: ReturnType<typeof createSlideStripSelection>;
    menuCtl: ReturnType<typeof createSlideStripContextMenu>;
    searchDlg: ReturnType<typeof createSlideStripSearchDialog>;
    rename: ReturnType<typeof createRenameState>;
    searchQuery: string;
    theme: string;
    language: string;
    activeHighlightIndex: number;
    onRemove: (id: string) => void;
    onDuplicate: (id: string) => void;
    unstackSlides: (ids: string[]) => void;
    addSlide: {
      addSlide: () => Promise<unknown> | unknown;
      isPending: boolean;
    };
    flipMs: number;
  } = $props();

  const dragDisabled = $derived(
    searchQuery.trim().length > 0 || rename.renamingId !== null,
  );

  // Cards read rename/action wiring from context (§2.1) — only per-card
  // data (slide, tab stop, multi-select state) stays in props. Provided
  // once (untrack); the closures late-bind the current prop values.
  provideSlideCardActions(
    untrack(() => ({
      get renamingId() {
        return rename.renamingId;
      },
      get renameValue() {
        return rename.value;
      },
      setRenameValue: (v: string) => (rename.value = v),
      commitRename: () => void rename.commit(),
      cancelRename: () => rename.cancel(),
      startRename: (id: string, current: string) => rename.start(id, current),
      remove: (id: string) => onRemove(id),
      duplicate: (id: string) => onDuplicate(id),
      registerCardRef: (id: string, node: HTMLDivElement | null) =>
        strip.registerCardRef(id, node),
      toggleMultiSelect: (id: string, position?: { x: number; y: number }) =>
        selection.toggleSlideSelection(id, position),
      openContextMenu: (event: MouseEvent, slide: Slide, title: string) =>
        menuCtl.open(event, slide, title),
    })),
  );
</script>

{#snippet stackTargetOverlay(targetId: string, ownerItemId: string)}
  {@const isDraggingOther =
    dnd.draggingId !== null && dnd.draggingId !== ownerItemId}
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
    highlightProgress={activeHighlightIndex}
    cardRefs={strip.cardRefs}
    navigationIds={strip.navIds}
    isTabStop={slide.id === strip.tabStopId}
    isMultiSelectMode={selection.isMultiSelectMode}
    isMultiSelected={selection.selectedSlideIds.has(slide.id)}
    {theme}
    {language}
    {searchQuery}
    enableHoverPreview={ui.showSlideHoverPreview}
  />
{/snippet}

{#snippet shadowPlaceholder(item: StripItem)}
  <div
    class="shrink-0 self-center rounded-md border-2 border-dashed border-primary/50 bg-primary/10"
    style="width: {item.expanded
      ? item.slides.length * (ITEM_WIDTH + 8) + 96
      : ITEM_WIDTH}px; height: {ITEM_HEIGHT}px;"
  ></div>
{/snippet}

{#snippet renderItem(item: StripItem)}
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
  {:else}
    {@const firstSlide = item.slides[0]!}
    <div
      class="relative shrink-0"
      data-stack-card={firstSlide.id}
      data-stack-section={firstSlide.sectionId?.trim() ?? ""}
    >
      {@render stackTargetOverlay(firstSlide.id, item.id)}
      {#if item.slides.length > 1}
        <StackDeck
          count={item.slides.length}
          variant="slide"
          class="shrink-0"
          style="height: {ITEM_HEIGHT}px;"
          onExpand={() => (strip.expandedSectionId = item.groupId)}
          onOpenTop={() => setCurrentSlideId(firstSlide.id)}
        >
          {@render cardFor(firstSlide)}
        </StackDeck>
      {:else}
        {@render cardFor(firstSlide)}
      {/if}
    </div>
  {/if}
{/snippet}

<div class="flex h-full min-h-[140px] min-w-0 flex-col bg-card/60">
  <div
    class="flex min-h-0 flex-1 items-center gap-2 overflow-x-auto overflow-y-hidden px-3 py-1"
    style="touch-action: pan-x;"
  >
    <SlideStripDndZone {dnd} {flipMs} {dragDisabled} {renderItem} />
    <button
      type="button"
      onclick={() => void addSlide.addSlide()}
      disabled={addSlide.isPending}
      class="grid h-[132px] w-[152px] shrink-0 place-items-center self-center rounded-md border border-dashed border-border/80 bg-card/30 text-muted-foreground transition-all hover:border-primary/60 hover:bg-primary/5 hover:text-primary disabled:pointer-events-none disabled:opacity-50"
      title="Add slide"
    >
      <Plus class="h-7 w-7 stroke-[1.35]" />
    </button>
  </div>

  <SlideSearchDialog
    open={searchDlg.isOpen}
    query={searchDlg.query}
    scope={searchDlg.scope}
    onQueryChange={searchDlg.changeQuery}
    onScopeChange={searchDlg.changeScope}
    onSubmitCodeSearch={searchDlg.submitCodeSearch}
    onClose={searchDlg.close}
  />

  <SlideContextMenu
    open={menuCtl.menu !== null}
    position={menuCtl.menu?.position ?? { x: 0, y: 0 }}
    onRename={() => {
      if (menuCtl.menu) rename.start(menuCtl.menu.slide.id, menuCtl.menu.title);
      menuCtl.close();
    }}
    onStartSelection={selection.startMultiSelect}
    onSelectAll={selection.selectAllSlides}
    onClose={menuCtl.close}
  />

  <SlideSelectionToolbar
    open={selection.isMultiSelectMode}
    selectionCount={selection.selectedSlideIds.size}
    totalSlides={strip.ordered.length}
    onMoveToStart={() => selection.moveSelected("start")}
    onMoveToEnd={() => selection.moveSelected("end")}
    onGroup={selection.groupSelected}
    onDelete={selection.deleteSelected}
    onCancel={selection.clearSlideSelection}
  />

  <ConfirmDialog
    open={selection.confirmBulkDelete}
    title="Delete {selection.selectedSlideIds.size} selected slide{selection
      .selectedSlideIds.size === 1
      ? ''
      : 's'}?"
    description="This cannot be undone."
    confirmLabel="Delete"
    destructive
    onConfirm={selection.confirmDeleteSelected}
    onCancel={() => (selection.confirmBulkDelete = false)}
  />
</div>
