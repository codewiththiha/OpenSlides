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
import { Plus } from "lucide-react";
import { resolveProjectLanguage, type Project, type Slide } from "@/types";
import { useSlideStripSearch } from "@/hooks/useSlideStripSearch";
import { useInlineRename } from "@/hooks/useInlineRename";
import { useAddSlide } from "@/hooks/useAddSlide";
import {
  useDeleteSlideWithUndo,
  useDuplicateSlide,
  useReorderSlides,
  useStackSlides,
} from "@/hooks/useSlideActions";
import { SlideCard } from "./slides/SlideCard";
import { SortableSlideItem } from "./slides/SortableSlideItem";
import { SlideSearchDialog, type SearchScope } from "./slides/SlideSearchDialog";
import { SlideContextMenu } from "./slides/SlideContextMenu";
import { SlideSelectionToolbar } from "./slides/SlideSelectionToolbar";
import { ConfirmDialog } from "./ui/confirm-dialog";
import { StackExpandedControls } from "./ui/stack/StackExpandedControls";
import { useUiStore } from "@/store/useUiStore";
import { chunkConsecutive } from "@/lib/grouping";
import { useAutoDissolveStacks } from "@/hooks/useAutoDissolveStacks";
import { useStackDragEnd, type StackDragData, type StackDropData } from "@/hooks/useStackDragEnd";
import { isTypingTarget } from "@/lib/keyboard";
import { cn } from "@/lib/utils";

interface BottomSlidesPanelProps {
  project: Project;
  collapsed?: boolean;
  activeHighlightIndex?: number;
}

interface SlideDragData extends StackDragData {
  kind: "slide-item";
  slide: Slide;
}

interface SlideStackDropData extends StackDropData {
  kind: "slide-stack-target";
  targetId: string;
}

const dropAnimation: DropAnimation = {
  duration: 180,
  easing: "cubic-bezier(0.25, 1, 0.5, 1)",
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.4" } } }),
};

import { useUpdateSlideSettings } from "@/hooks/queries";

export function BottomSlidesPanel({
  project,
  collapsed,
  activeHighlightIndex = -1,
}: BottomSlidesPanelProps) {
  const setCurrentSlideId = useUiStore((s) => s.setCurrentSlideId);
  const showSlideHoverPreview = useUiStore((s) => s.showSlideHoverPreview);
  const currentSlideId = useUiStore((s) => s.currentSlideId);
  const isBottomPanelCollapsed = useUiStore((s) => s.isBottomPanelCollapsed);

  const isCollapsed = collapsed ?? isBottomPanelCollapsed;

  const addSlide = useAddSlide(project.id);
  const duplicateSlide = useDuplicateSlide(project.id);
  const reorderSlides = useReorderSlides(project.id);
  const { stackSlides, unstackSlides } = useStackSlides(project.id);
  const updateSettings = useUpdateSlideSettings(project.id);
  const theme = project.theme;
  const language = resolveProjectLanguage(project);

  const { handleStackDrop } = useStackDragEnd<SlideDragData, SlideStackDropData>({
    stackTargetKind: "slide-stack-target",
    resolveSourceIds: (activeData) => {
      const activeId = activeData?.id ? String(activeData.id) : null;
      if (!activeId) return [];
      const activeSlide = project.slides.find((slide) => slide.id === activeId);
      const sectionId = activeSlide?.sectionId?.trim();
      // Dragging the visible top card of a stack represents its entire
      // section, not only that first slide.
      return sectionId
        ? project.slides.filter((slide) => slide.sectionId?.trim() === sectionId).map((slide) => slide.id)
        : [activeId];
    },
    resolveTargetId: (overData) => overData.targetId,
    onStack: (sourceIds, targetId) => {
      stackSlides(sourceIds, targetId);
    },
  });

  useAutoDissolveStacks(
    project.slides,
    (s) => s.sectionId,
    (s) => s.id,
    unstackSlides,
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

  const { deleteSlideWithUndo, deleteSlides } = useDeleteSlideWithUndo(project.id, {
    ordered,
    renamingId: rename.renamingId,
    pendingFocusId,
  });

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
      reorderSlides(nextIds, {
        onError: () => setOrdered(previous),
      });
    },
    [ordered, slideChunks, handleStackDrop, reorderSlides, searchQuery],
  );

  const onDragCancel = useCallback(() => setActiveId(null), []);

  const handleRemove = deleteSlideWithUndo;
  const handleDuplicate = duplicateSlide;

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
    reorderSlides(destination === "start" ? [...selected, ...remaining] : [...remaining, ...selected]);
    closeContextMenu();
  }, [closeContextMenu, ordered, reorderSlides, selectedInOrder]);

  const groupSelected = useCallback(() => {
    const selected = selectedInOrder();
    if (selected.length < 2) return;
    stackSlides(selected.slice(1), selected[0], {
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
      const result = await deleteSlides(selected);
      if (result.ok) {
        setSelectedSlideIds(new Set());
        setIsMultiSelectMode(false);
        return;
      }
      // Keep any slides that were not deleted selected so the user can retry
      // or choose another bulk action without losing context.
      setSelectedSlideIds((current) => new Set([...current].filter((id) => !result.deletedIds.has(id))));
    })();
  }, [deleteSlides, selectedInOrder]);

  if (isCollapsed) {
    return (
      <div className="flex h-full min-h-[36px] items-stretch overflow-x-auto border-y border-border/50 bg-card/60">
        {ordered.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => setCurrentSlideId(slide.id)}
            className={cn(
              "flex h-full min-w-11 shrink-0 items-center justify-center border-r border-border/60 px-3 text-sm font-bold tabular-nums transition-colors",
              currentSlideId === slide.id
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
            title={`Slide ${index + 1}`}
          >
            {index + 1}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void addSlide()}
          className="flex h-full min-w-11 shrink-0 items-center justify-center px-3 text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary disabled:opacity-50"
          title="Add slide"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[140px] min-w-0 flex-col bg-card/60">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
          <div
            className="flex min-h-0 flex-1 items-center gap-2 overflow-x-auto overflow-y-hidden px-3 py-1"
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
                    className="flex min-h-[132px] items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-2 py-1 transition-all duration-200"
                  >
                    <StackExpandedControls
                      count={chunk.items.length}
                      variant="slide-strip"
                      onUngroup={() => {
                        unstackSlides(chunk.items.map((s) => s.id));
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
              onClick={() => void addSlide()}
              className="grid h-[132px] w-[152px] shrink-0 self-center place-items-center rounded-md border border-dashed border-border/80 bg-card/30 text-muted-foreground transition-all hover:border-primary/60 hover:bg-primary/5 hover:text-primary disabled:pointer-events-none disabled:opacity-50"
              title="Add slide"
            >
              <Plus className="h-7 w-7 stroke-[1.35]" />
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
