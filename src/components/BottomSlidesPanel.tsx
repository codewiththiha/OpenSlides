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
import {
  ChevronUp,
  Ungroup,
  X,
} from "lucide-react";
import { resolveProjectLanguage, type Project, type Slide } from "@/types";
import { useSlideStripSearch } from "@/hooks/useSlideStripSearch";
import { useInlineRename } from "@/hooks/useInlineRename";
import { useSlidePanelActions } from "@/hooks/useSlidePanelActions";
import { SlideCard } from "./slides/SlideCard";
import { SortableSlideItem } from "./slides/SortableSlideItem";
import { SlidesPanelHeader } from "./slides/SlidesPanelHeader";
import { CollapsedPanelButton } from "./ui/collapsed-panel-button";
import { Button } from "./ui/button";
import { useUiStore } from "@/store/useUiStore";
import { chunkConsecutive } from "@/lib/grouping";

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

  useEffect(() => {
    const groupCounts = new Map<string, string[]>();
    for (const s of project.slides) {
      if (s.sectionId && s.sectionId.trim().length > 0) {
        const sid = s.sectionId.trim();
        if (!groupCounts.has(sid)) groupCounts.set(sid, []);
        groupCounts.get(sid)!.push(s.id);
      }
    }
    for (const [, ids] of groupCounts.entries()) {
      if (ids.length <= 1) {
        unstackSlides.mutate(ids);
      }
    }
  }, [project.slides, unstackSlides]);

  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);

  const [ordered, setOrdered] = useState<Slide[]>(project.slides);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const pendingFocusId = useRef<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    const onFocusRequest = () => {
      const { isBottomPanelCollapsed, setIsBottomPanelCollapsed } = useUiStore.getState();
      if (isBottomPanelCollapsed) setIsBottomPanelCollapsed(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        });
      });
    };
    window.addEventListener("openslides:focus-slide-search", onFocusRequest);
    return () => window.removeEventListener("openslides:focus-slide-search", onFocusRequest);
  }, []);

  const { rawSearchQuery, setRawSearchQuery, searchQuery, clearSearch, filteredOrdered } =
    useSlideStripSearch({ projectId: project.id, ordered });

  const [activeId, setActiveId] = useState<string | null>(null);

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

      const overData = over.data?.current;
      if (overData?.kind === "slide-stack-target") {
        const targetId = String(overData.targetId);
        if (String(active.id) !== targetId) {
          stackSlides.mutate({ sourceIds: [String(active.id)], targetId });
        }
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
    [ordered, slideChunks, stackSlides, reorder, searchQuery],
  );

  const onDragCancel = useCallback(() => setActiveId(null), []);

  const { handleRemove, handleDuplicate, handleAdd } = useSlidePanelActions({
    ordered,
    renamingId: rename.renamingId,
    mutations: { deleteSlide, restoreSlide, duplicateSlide, createSlide },
    currentSlideId,
    setCurrentSlideId,
    pendingFocusId,
  });

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
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-card/60">
      <SlidesPanelHeader
        ordered={ordered}
        filteredOrdered={filteredOrdered}
        rawSearchQuery={rawSearchQuery}
        searchQuery={searchQuery}
        onSearchChange={setRawSearchQuery}
        onClearSearch={clearSearch}
        onSearchKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            if (rawSearchQuery) setRawSearchQuery("");
            else e.currentTarget.blur();
          }
          if (e.key === "Enter" && filteredOrdered.length > 0) {
            e.preventDefault();
            const first = filteredOrdered[0];
            setCurrentSlideId(first.id);
            cardRefs.current.get(first.id)?.scrollIntoView({ inline: "nearest" });
          }
        }}
        searchInputRef={searchInputRef}
        onAdd={handleAdd}
        addPending={createSlide.isPending}
        onToggleCollapse={toggleCollapse}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
          <div
            className="flex min-h-0 flex-1 gap-2 overflow-x-auto overflow-y-hidden px-3 pb-3 pt-0.5"
            style={{ touchAction: "pan-x" }}
            role="listbox"
            aria-label="Slides"
          >
            {slideChunks.map((chunk) => {
              const isStack = chunk.kind === "stack" && chunk.items.length > 1;
              const isExpanded = isStack && chunk.groupId === expandedSectionId;

              if (isExpanded) {
                return (
                  <div
                    key={chunk.groupId}
                    className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-2 py-1 transition-all duration-200"
                  >
                    <div className="flex flex-col gap-1 border-r border-border/60 pr-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1 px-2 text-[11px] font-semibold text-primary hover:bg-primary/20"
                        onClick={() => {
                          unstackSlides.mutate(chunk.items.map((s) => s.id));
                          setExpandedSectionId(null);
                        }}
                        title="Ungroup slide section"
                      >
                        <Ungroup className="h-3 w-3" />
                        Ungroup
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 self-center text-muted-foreground hover:text-foreground"
                        onClick={() => setExpandedSectionId(null)}
                        title="Collapse section fan"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
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
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeSlide ? (
            <SlideCard slide={activeSlide} index={activeIndex} isOverlay theme={theme} language={language} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
