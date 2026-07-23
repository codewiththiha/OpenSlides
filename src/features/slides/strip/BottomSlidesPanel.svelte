<script lang="ts">
  /**
   * Horizontal slide strip — composition root. Wiring lives here (queries,
   * mutations, controllers); behavior lives in the strip controllers:
   *
   *  - slide-strip-state.svelte — strip items, roving focus, chunks
   *  - dnd/slide-dnd.svelte + pure modules — drag & stack-drop logic
   *  - SlideStrip*Controller.svelte.ts — selection, context menu, search
   *    dialog, rename, keyboard batch actions
   *
   * Rendering is split between SlideStripCollapsedBar and
   * SlideStripExpanded.
   */
  import { untrack } from "svelte";
  import { resolveProjectLanguage, type Project, type Slide } from "$lib/types";
  import { createSlideStripState } from "../slide-strip-state.svelte";
  import { createSlideStripDnd } from "../dnd/slide-dnd.svelte";
  import { createSlideStripSearch } from "@/features/slides/slide-search.svelte";
  import { createAddSlide } from "@/features/slides/add-slide.svelte";
  import {
    createSlideDeleter,
    createSlideDuplicator,
    createSlideReorderer,
    createSlideStackActions,
  } from "@/features/slides/slide-actions.svelte";
  import { ui } from "$lib/stores/ui-state.svelte";
  import { autoDissolveStacks } from "$lib/lib/stacking.svelte";
  import { updateSlideSettingsMutation } from "$lib/queries";
  import { createSlideStripContextMenu } from "./SlideStripContextMenuController.svelte";
  import { createSlideStripSelection } from "./SlideStripSelectionController.svelte";
  import { createSlideStripSearchDialog } from "./SlideStripSearchDialogController.svelte";
  import { createSlideStripRename } from "./SlideStripRenameController.svelte";
  import { createSlideStripKeyboardActions } from "./SlideStripKeyboardActions.svelte";
  import SlideStripCollapsedBar from "./SlideStripCollapsedBar.svelte";
  import SlideStripExpanded from "./SlideStripExpanded.svelte";

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

  const dnd = createSlideStripDnd({
    baseItems: () => strip.baseItems,
    filtering: () => searchQuery.trim().length > 0,
    resolveSourceIds,
    ordered: () => strip.ordered,
    setOrdered: (slides: Slide[]) => (strip.ordered = slides),
    onStack: stackSlides,
    onReorder: (ids, opts) => reorderSlides(ids, opts),
  });

  // Controllers. Selection and the context menu reference each other, so
  // the selection controller is created last and read lazily (via `refs`)
  // by the menu callbacks.
  const refs = {} as {
    selection?: ReturnType<typeof createSlideStripSelection>;
  };
  const menuCtl = createSlideStripContextMenu({
    isMultiSelectMode: () => refs.selection!.isMultiSelectMode,
    toggleSlideSelection: (id) => refs.selection!.toggleSlideSelection(id),
  });

  const rename = createSlideStripRename({
    updateSettings,
    ordered: () => strip.ordered,
    setOrdered: (slides) => (strip.ordered = slides),
  });

  const deleter = createSlideDeleter(projectId, {
    ordered: () => strip.ordered,
    renamingId: () => rename.renamingId,
    pendingFocusId: strip.pendingFocusId,
  });

  refs.selection = createSlideStripSelection({
    ordered: () => strip.ordered,
    menuCtl: () => menuCtl,
    reorderSlides,
    stackSlides,
    deleter,
  });
  const selection = refs.selection;

  const searchDlg = createSlideStripSearchDialog({ search });

  createSlideStripKeyboardActions({ selection: () => selection });
</script>

{#if isCollapsed}
  <SlideStripCollapsedBar slides={strip.ordered} addSlide={addSlideMut} />
{:else}
  <SlideStripExpanded
    {strip}
    {dnd}
    {selection}
    {menuCtl}
    {searchDlg}
    {rename}
    {searchQuery}
    {theme}
    {language}
    {activeHighlightIndex}
    onRemove={deleter.deleteSlideWithUndo}
    onDuplicate={duplicateSlide}
    {unstackSlides}
    addSlide={addSlideMut}
    flipMs={FLIP_MS}
  />
{/if}
