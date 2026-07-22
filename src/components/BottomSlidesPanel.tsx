/**
 * Horizontal slide strip — fixed re-render storm.
 *
 * BEFORE: every SlideCard did
 *   const codeOverride = useUiStore(s => s.localCode[slide.id])
 *   const currentSlideId = useUiStore(s => s.currentSlideId)
 * Not memoed, so parent re-render (project.slides ref change on save) caused
 * 20 cards to re-render. Typing in A → 20 selector calls + 20 renders.
 *
 * AFTER:
 * - SlideCard is React.memo with custom comparator
 * - Per-slide atoms: useLocalCodeAtom(slide.id) only notifies that ID
 * - isSelected via boolean selector s => s.currentSlideId === slide.id (only 2 cards re-render on slide switch)
 * - preview derived from atom, not whole store
 * - setCurrentSlideId stable
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  defaultDropAnimationSideEffects,
  type DropAnimation,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { ChevronUp, Plus } from "lucide-react";
import { resolveProjectLanguage, type Project, type Slide } from "@/types";
import { useSlideStripSearch } from "@/hooks/useSlideStripSearch";
import { useInlineRename } from "@/hooks/useInlineRename";
import { useSlidePanelActions } from "@/hooks/useSlidePanelActions";
import { SlideCard } from "./slides/SlideCard";
import { SortableSlideItem } from "./slides/SortableSlideItem";
import { SlideSearchDialog, type SearchScope } from "./slides/SlideSearchDialog";
import { SlideContextMenu } from "./slides/SlideContextMenu";
import { SlideSelectionToolbar } from "./slides/SlideSelectionToolbar";
import { ConfirmDialog } from "./ui/confirm-dialog";
import { CollapsedPanelButton } from "./ui/collapsed-panel-button";
import { StackExpandedControls } from "./ui/stack/StackExpandedControls";
import { useUiStore } from "@/store/useUiStore";
import { chunkConsecutive } from "@/lib/grouping";
import { useAutoDissolveStacks } from "@/hooks/useAutoDissolveStacks";
import { useStackDragEnd } from "@/hooks/useStackDragEnd";
import { isTypingTarget } from "@/lib/keyboard";

interface BottomSlidesPanelProps {
  project: Project;
  collapsed?: boolean;
  activeHighlightIndex?: number;
  onToggleCollapse?: () => void;
}

const dropAnimation: DropAnimation = {
  duration: 180,
  easing: "cubic-bezier(0.25, 1, 0.5, 1)",
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.4" } } }),
};

import {
  useCreateSlide,
  useDeleteSlide,
  useDuplicateSlide,
  useReorderSlides,
  useRestoreSlide,
  useUpdateSlideSettings,
  useStackSlides,
  useUnstackSlides,
} from "@/hooks/queries";

export function BottomSlidesPanel({
  project,
  collapsed,
  activeHighlightIndex = -1,
  onToggleCollapse,
}: BottomSlidesPanelProps) {
  const setCurrentSlideId = useUiStore((s) => s.setCurrentSlideId);
  const showSlideHoverPreview = useUiStore((s) => s.showSlideHoverPreview);
  const currentSlideId = useUiStore((s) => s.currentSlideId);
  const isBottomPanelCollapsed = useUiStore((s) => s.isBottomPanelCollapsed);
  const setIsBottomPanelCollapsed = useUiStore(
    (s) => s.setIsBottomPanelCollapsed,
  );

  const isCollapsed = collapsed ?? isBottomPanelCollapsed;
  const toggleCollapse =
    onToggleCollapse ?? (() => setIsBottomPanelCollapsed(!isBottomPanelCollapsed));

  const createSlide = useCreateSlide(project.id);
  const deleteSlide = useDeleteSlide(project.id);
  const duplicateSlide = useDuplicateSlide(project.id);
  const restoreSlide = useRestoreSlide(project.id);
  const reorder = useReorderSlides(project.id);
  const updateSettings = useUpdateSlideSettings(project.id);
  const stackSlides = useStackSlides(project.id);
  const unstackSlides = useUnstackSlides(project.id);
  const theme = project.theme;
  const language = resolveProjectLanguage(project);

  const { handleStackDrop } = useStackDragEnd({
    stackTargetKind: "slide-stack-target",
    resolveSourceIds: (activeData: any) =>
      activeData?.id ? [String(activeData.id)] : [],
    resolveTargetId: (overData: any) =>
      overData?.targetId ? String(overData.targetId) : null,
    onStack: (sourceIds, targetId) => {
      stackSlides.mutate({ sourceIds, targetId });
    },
  });

  useAutoDissolveStacks(
    project.slides,
    (s) => s.sectionId,
    (s) => s.id,
    unstackSlides.mutate,
  );

  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);

  const [ordered, setOrdered] = useState<Slide[]>(project.slides);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const pendingFocusId = useRef<string | null>(null);
  useEffect(() => {
    setOrdered(project.slides);
  }, [project.slides]);
  useEffect(() => {
    const id = pendingFocusId.current;
    if (!id) return;
    const node = cardRefs.current.get(id);
    if (!node) return;
    node.focus();
    node.scrollIntoView({ inline: "nearest", block: "nearest" });
    pendingFocusId.current = null;
  }, [ordered]);

  const registerCardRef = useCallback((id: string, node: HTMLDivElement | null) => {
    if (node) cardRefs.current.set(id, node);
    else cardRefs.current.delete(id);
  }, []);

  const { rawSearchQuery, setRawSearchQuery, searchQuery, clearSearch, filteredOrdered } =
    useSlideStripSearch({ projectId: project.id, ordered });

  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedSlideIds, setSelectedSlideIds] = useState<Set<string>>(() => new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    slide: Slide;
    title: string;
    position: { x: number; y: number };
  } | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  const [searchScope, setSearchScope] = useState<SearchScope>("slides");
  const [searchDialogQuery, setSearchDialogQuery] = useState("");

  useEffect(() => {
    const openSearch = () => {
      const { isBottomPanelCollapsed, setIsBottomPanelCollapsed } = useUiStore.getState();
      if (isBottomPanelCollapsed) setIsBottomPanelCollapsed(false);
      setSearchScope("slides");
      setSearchDialogQuery(rawSearchQuery);
      setIsSearchDialogOpen(true);
    };
    window.addEventListener("openslides:open-search", openSearch);
    return () => window.removeEventListener("openslides:open-search", openSearch);
  }, [rawSearchQuery]);

  const rename = useInlineRename(
    useCallback(
      async (id: string, name: string) => {
        const finalName = name || "Untitled slide";
        await new Promise<void>((resolve) => {
          updateSettings.mutate(
            { slideId: id, payload: { name: finalName } },
            {
              onSuccess: () => {
                setOrdered((items) =>
                  items.map((s) => (s.id === id ? { ...s, name: finalName } : s)),
                );
                resolve();
              },
              onError: () => resolve(),
            },
          );
        });
      },
      [updateSettings],
    ),
  );

  const activeSlide = useMemo(
    () => ordered.find((s) => s.id === activeId) ?? null,
    [ordered, activeId],
  );
  const activeIndex = activeSlide
    ? ordered.findIndex((s) => s.id === activeSlide.id)
    : -1;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const slideChunks = useMemo(() => chunkConsecutive(filteredOrdered), [filteredOrdered]);
  const ids = useMemo(() => filteredOrdered.map((s) => s.id), [filteredOrdered]);
  const tabStopId = filteredOrdered.find((s) => s.id === currentSlideId)?.id ?? filteredOrdered[0]?.id;

  const onDragStart = useCallback((event: DragStartEvent) => {
    if (searchQuery.trim()) return; // disable drag when filtering
    setActiveId(String(event.active.id));
  }, [searchQuery]);

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      if (searchQuery.trim()) return; // disable reorder when filtering
      if (!over || active.id === over.id) return;

      if (handleStackDrop(active, over)) {
        return;
      }

      const oldChunkIndex = slideChunks.findIndex((c) => c.items.some((s) => s.id === active.id));
      const newChunkIndex = slideChunks.findIndex((c) => c.items.some((s) => s.id === over.id));
      if (oldChunkIndex < 0 || newChunkIndex < 0) return;

      const previous = ordered;
      const nextChunks = arrayMove(slideChunks, oldChunkIndex, newChunkIndex);
      const nextIds = nextChunks.flatMap((c) => c.items.map((s) => s.id));
      const nextOrdered = nextIds
        .map((id) => ordered.find((s) => s.id === id)!)
        .filter(Boolean);

      setOrdered(nextOrdered);
      reorder.mutate(nextIds, {
        onError: () => setOrdered(previous),
      });
    },
    [ordered, slideChunks, handleStackDrop, reorder, searchQuery],
  );

  const onDragCancel = useCallback(() => setActiveId(null), []);

  const { handleRemove, handleDuplicate, handleAdd } = useSlidePanelActions({
    ordered,
    renamingId: rename.renamingId,
    mutations: { deleteSlide, restoreSlide, duplicateSlide, createSlide, updateSettings },
    currentSlideId,
    setCurrentSlideId,
    pendingFocusId,
  });

  const selectedInOrder = useCallback(
    () => ordered.filter((slide) => selectedSlideIds.has(slide.id)).map((slide) => slide.id),
    [ordered, selectedSlideIds],
  );

  const toggleSlideSelection = useCallback((id: string, position?: { x: number; y: number }) => {
    setSelectedSlideIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (position) {
      setContextMenu((current) => current ? { ...current, position } : current);
    }
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const openContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>, slide: Slide, title: string) => {
    setCurrentSlideId(slide.id);
    if (isMultiSelectMode) {
      toggleSlideSelection(slide.id);
      return;
    }
    setContextMenu({ slide, title, position: { x: event.clientX, y: event.clientY } });
  }, [isMultiSelectMode, setCurrentSlideId, toggleSlideSelection]);

  const startMultiSelect = useCallback(() => {
    if (!contextMenu) return;
    setIsMultiSelectMode(true);
    setSelectedSlideIds(new Set([contextMenu.slide.id]));
    closeContextMenu();
  }, [closeContextMenu, contextMenu]);

  const selectAllSlides = useCallback(() => {
    setIsMultiSelectMode(true);
    setSelectedSlideIds(new Set(ordered.map((slide) => slide.id)));
    closeContextMenu();
  }, [closeContextMenu, ordered]);

  const clearSlideSelection = useCallback(() => {
    setSelectedSlideIds(new Set());
    setIsMultiSelectMode(false);
    closeContextMenu();
  }, [closeContextMenu]);

  const changeSearchScope = useCallback((scope: SearchScope) => {
    setSearchScope(scope);
    if (scope === "code") clearSearch();
    else setRawSearchQuery(searchDialogQuery);
  }, [clearSearch, searchDialogQuery, setRawSearchQuery]);

  const changeSearchQuery = useCallback((value: string) => {
    setSearchDialogQuery(value);
    if (searchScope === "slides") setRawSearchQuery(value);
  }, [searchScope, setRawSearchQuery]);

  const submitCodeSearch = useCallback(() => {
    window.dispatchEvent(new CustomEvent("openslides:find-in-code", { detail: { query: searchDialogQuery } }));
    setIsSearchDialogOpen(false);
  }, [searchDialogQuery]);

  // Reserve the bottom-right toast slot for the batch-action bubbles. The
  // toaster moves above it only while a multi-selection is active.
  useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute("data-slide-selection-active", isMultiSelectMode);
    return () => root.removeAttribute("data-slide-selection-active");
  }, [isMultiSelectMode]);

  const moveSelected = useCallback((destination: "start" | "end") => {
    const selected = selectedInOrder();
    if (!selected.length) return;
    const selectedSet = new Set(selected);
    const remaining = ordered.filter((slide) => !selectedSet.has(slide.id)).map((slide) => slide.id);
    reorder.mutate(destination === "start" ? [...selected, ...remaining] : [...remaining, ...selected]);
    closeContextMenu();
  }, [closeContextMenu, ordered, reorder, selectedInOrder]);

  const groupSelected = useCallback(() => {
    const selected = selectedInOrder();
    if (selected.length < 2) return;
    stackSlides.mutate({ sourceIds: selected.slice(1), targetId: selected[0] }, {
      onSuccess: () => setSelectedSlideIds(new Set(selected)),
    });
    closeContextMenu();
  }, [closeContextMenu, selectedInOrder, stackSlides]);

  const deleteSelected = useCallback(() => {
    const selected = selectedInOrder();
    if (!selected.length || selected.length >= ordered.length) return;
    setConfirmBulkDelete(true);
    closeContextMenu();
  }, [closeContextMenu, ordered.length, selectedInOrder]);

  // Keyboard batch actions remain available even when the right-click menu is gone.
  useEffect(() => {
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
  }, [clearSlideSelection, confirmBulkDelete, deleteSelected, isMultiSelectMode]);

  const confirmDeleteSelected = useCallback(() => {
    const selected = selectedInOrder();
    setConfirmBulkDelete(false);
    void (async () => {
      for (const id of selected) await deleteSlide.mutateAsync(id);
      setSelectedSlideIds(new Set());
      setIsMultiSelectMode(false);
    })();
  }, [deleteSlide, selectedInOrder]);

  if (isCollapsed) {
    return (
      <CollapsedPanelButton
        orientation="horizontal"
        icon={ChevronUp}
        label={`Slides (${ordered.length})`}
        onClick={toggleCollapse}
        title="Expand slides (or drag the handle above)"
      />
    );
  }

  return (
    <div className="flex h-full min-h-[172px] min-w-0 flex-col bg-card/60">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
          <div
            className="flex min-h-0 flex-1 items-center gap-2 overflow-x-auto overflow-y-hidden px-3 pb-3 pt-0.5"
            style={{ touchAction: "pan-x" }}
            role="listbox"
            aria-label="Slides"
          >
            {slideChunks.map((chunk) => {              const isStack = chunk.kind === "stack" && chunk.items.length > 1;
              const isExpanded = isStack && chunk.groupId === expandedSectionId;

              if (isExpanded) {
                return (
                  <div
                    key={chunk.groupId}
                    className="flex min-h-[140px] items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-2 py-1 transition-all duration-200"
                  >
                    <StackExpandedControls
                      count={chunk.items.length}
                      variant="slide-strip"
                      onUngroup={() => {
                        unstackSlides.mutate(chunk.items.map((s) => s.id));
                        setExpandedSectionId(null);
                      }}
                      onClose={() => setExpandedSectionId(null)}
                    />
                    {chunk.items.map((slide) => {
                      const originalIndex = ordered.findIndex((s) => s.id === slide.id);
                      return (
                        <SortableSlideItem
                          key={slide.id}
                          slide={slide}
                          index={originalIndex >= 0 ? originalIndex : 0}
                          onRemove={handleRemove}
                          onDuplicate={handleDuplicate}
                          isDraggingId={activeId}
                          isRenaming={rename.renamingId === slide.id}
                          renameValue={rename.renamingId === slide.id ? rename.value : ""}
                          highlightProgress={activeHighlightIndex}
                          onRenameValueChange={rename.setValue}
                          onCommitRename={() => void rename.commit()}
                          onCancelRename={rename.cancel}
                          onRename={rename.start}
                          registerCardRef={registerCardRef}
                          navigationIds={ids}
                          cardRefs={cardRefs}
                          isTabStop={slide.id === tabStopId}
                          isMultiSelectMode={isMultiSelectMode}
                          isMultiSelected={selectedSlideIds.has(slide.id)}
                          onToggleMultiSelect={toggleSlideSelection}
                          onOpenContextMenu={openContextMenu}
                          theme={theme}
                          language={language}
                          searchQuery={searchQuery}
                          enableHoverPreview={showSlideHoverPreview}
                        />
                      );
                    })}
                  </div>
                );
              }

              const topSlide = chunk.items[0];
              const originalIndex = ordered.findIndex((s) => s.id === topSlide.id);
              return (
                <SortableSlideItem
                  key={isStack ? chunk.groupId : topSlide.id}
                  slide={topSlide}
                  index={originalIndex >= 0 ? originalIndex : 0}
                  onRemove={handleRemove}
                  onDuplicate={handleDuplicate}
                  isDraggingId={activeId}
                  isRenaming={rename.renamingId === topSlide.id}
                  renameValue={rename.renamingId === topSlide.id ? rename.value : ""}
                  highlightProgress={activeHighlightIndex}
                  onRenameValueChange={rename.setValue}
                  onCommitRename={() => void rename.commit()}
                  onCancelRename={rename.cancel}
                  onRename={rename.start}
                  registerCardRef={registerCardRef}
                  navigationIds={ids}
                  cardRefs={cardRefs}
                  isTabStop={topSlide.id === tabStopId}
                  isMultiSelectMode={isMultiSelectMode}
                  isMultiSelected={selectedSlideIds.has(topSlide.id)}
                  onToggleMultiSelect={toggleSlideSelection}
                  onOpenContextMenu={openContextMenu}
                  theme={theme}
                  language={language}
                  searchQuery={searchQuery}
                  enableHoverPreview={showSlideHoverPreview}
                  isStack={isStack}
                  count={chunk.items.length}
                  onExpand={() => setExpandedSectionId(chunk.groupId!)}
                  onOpenTop={() => setCurrentSlideId(topSlide.id)}
                />
              );
            })}
            <button
              type="button"
              onClick={handleAdd}
              disabled={createSlide.isPending}
              className="flex h-[132px] w-[152px] shrink-0 self-center flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border/80 bg-card/30 text-muted-foreground transition-all hover:border-primary/60 hover:bg-primary/5 hover:text-primary disabled:pointer-events-none disabled:opacity-50"
              title="Add slide"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full border border-current/30 bg-background/50">
                <Plus className="h-3.5 w-3.5" />
              </span>
              <span className="text-xs font-medium">Add</span>
            </button>
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeSlide ? (
            <SlideCard slide={activeSlide} index={activeIndex} isOverlay theme={theme} language={language} />
          ) : null}
        </DragOverlay>
      </DndContext>

      <SlideSearchDialog
        open={isSearchDialogOpen}
        query={searchDialogQuery}
        scope={searchScope}
        onQueryChange={changeSearchQuery}
        onScopeChange={changeSearchScope}
        onSubmitCodeSearch={submitCodeSearch}
        onClose={() => {
          setIsSearchDialogOpen(false);
          if (searchScope === "code") setSearchDialogQuery("");
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
        title={`Delete ${selectedSlideIds.size} selected slide${selectedSlideIds.size === 1 ? "" : "s"}?`}
        description="This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDeleteSelected}
        onCancel={() => setConfirmBulkDelete(false)}
      />
    </div>
  );
}
