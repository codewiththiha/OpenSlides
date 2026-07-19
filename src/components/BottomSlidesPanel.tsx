/**
 * Horizontal slide strip — now virtualized to handle 150+ slides.
 *
 * BEFORE: ordered.map(...) rendered 150 DOM nodes, 150 DnD sensors,
 * 150 Shiki preview snippets → scroll jank + drag-lag.
 *
 * AFTER:
 * - @tanstack/react-virtual horizontal virtualizer
 * - Only visible 10-15 slides + overscan 10 mounted in DOM
 * - During drag, fallback to full render for accurate closestCenter detection
 * - Memoed SlideCard + per-slide atom preserves previous re-render storm fix
 * - Auto-scroll into view for renaming / current slide via virtualizer.scrollToIndex
 */
import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
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
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Pencil,
  Highlighter as HighlighterIcon,
} from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { slideDisplayName, type Project, type Slide } from "@/types";
import { useUiStore } from "@/store/useUiStore";
import { useLocalCodeAtom } from "@/store/localCodeAtoms";
import { notify } from "@/lib/toast";
import {
  useCreateSlide,
  useDeleteSlide,
  useReorderSlides,
  useRestoreSlide,
  useUpdateSlideSettings,
} from "@/hooks/queries";

const ITEM_WIDTH = 152;
const GAP = 8; // gap-2 = 0.5rem
const ESTIMATED_SIZE = ITEM_WIDTH + GAP;

interface BottomSlidesPanelProps {
  project: Project;
  collapsed?: boolean;
  activeHighlightIndex?: number;
  onToggleCollapse?: () => void;
}

const dropAnimation: DropAnimation = {
  duration: 180,
  easing: "cubic-bezier(0.25, 1, 0.5, 1)",
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0.4" } },
  }),
};

interface SlideCardProps {
  slide: Slide;
  index: number;
  isOverlay?: boolean;
  isActive?: boolean;
  isRenaming?: boolean;
  renameValue?: string;
  highlightProgress?: number;
  onRenameValueChange?: (v: string) => void;
  onCommitRename?: () => void;
  onCancelRename?: () => void;
  onRemove?: (id: string) => void;
  onRename?: (id: string, current: string) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  setNodeRef?: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
}

const SlideCard = memo(function SlideCard({
  slide,
  index,
  isOverlay = false,
  isActive = false,
  isRenaming = false,
  renameValue = "",
  highlightProgress = -1,
  onRenameValueChange,
  onCommitRename,
  onCancelRename,
  onRemove,
  onRename,
  dragHandleProps,
  setNodeRef,
  style,
}: SlideCardProps) {
  const codeOverride = useLocalCodeAtom(slide.id);
  const isSelected = useUiStore((s) => s.currentSlideId === slide.id);
  const setCurrentSlideId = useUiStore((s) => s.setCurrentSlideId);

  const preview =
    (codeOverride ?? slide.code).split("\n")[0]?.slice(0, 28) || "Empty";
  const title = slideDisplayName(slide, index);
  const hlCount = slide.highlights?.length ?? 0;
  const progress = isSelected ? highlightProgress : -1;

  return (
    <div
      ref={setNodeRef}
      style={{ width: ITEM_WIDTH, ...style }}
      onClick={() => {
        if (isOverlay || isRenaming) return;
        setCurrentSlideId(slide.id);
      }}
      onContextMenu={(e) => {
        if (isOverlay || !onRename) return;
        e.preventDefault();
        e.stopPropagation();
        onRename(slide.id, title);
      }}
      className={cn(
        "group relative flex h-full shrink-0 cursor-pointer flex-col gap-1 rounded-md border p-2 select-none",
        "will-change-transform min-w-0",
        isOverlay
          ? "cursor-grabbing border-primary bg-card shadow-xl ring-2 ring-primary/40"
          : isSelected
            ? "border-primary/50 bg-muted ring-1 ring-primary/20"
            : "bg-background/60 hover:border-primary/30 hover:bg-muted/40",
        isActive && !isOverlay && "opacity-30",
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            className="shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
            {...dragHandleProps}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          {isRenaming ? (
            <input
              autoFocus
              className="h-5 min-w-0 flex-1 rounded border border-input bg-background px-1 text-xs font-medium outline-none focus:ring-1 focus:ring-ring"
              value={renameValue}
              onChange={(e) => onRenameValueChange?.(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={() => onCommitRename?.()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") onCommitRename?.();
                if (e.key === "Escape") onCancelRename?.();
              }}
            />
          ) : (
            <span
              className="truncate text-xs font-medium"
              title={`${title} — double-click or right-click to rename`}
              onDoubleClick={(e) => {
                if (!onRename) return;
                e.stopPropagation();
                onRename(slide.id, title);
              }}
            >
              {title}
            </span>
          )}
        </div>
        {!isOverlay && !isRenaming && (
          <div className="flex shrink-0 items-center gap-0.5">
            {onRename && (
              <button
                type="button"
                className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                title="Rename slide"
                onClick={(e) => {
                  e.stopPropagation();
                  onRename(slide.id, title);
                }}
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
            {onRemove && (
              <button
                type="button"
                className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(slide.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>
      <div
        className="truncate font-mono text-[10px] leading-tight text-muted-foreground"
        title={preview}
      >
        {preview}
      </div>
      <div className="mt-auto flex items-center justify-between gap-1">
        <span
          className="truncate text-[10px] text-muted-foreground/70"
          title={slide.language}
        >
          {slide.language}
        </span>
        {hlCount > 0 && (
          <span
            className="inline-flex shrink-0 items-center gap-[3px] rounded bg-primary/10 px-1.5 py-[3px]"
            title={`${hlCount} highlight${hlCount > 1 ? "s" : ""} — steps through with → before the next slide${
              progress >= 0 ? ` · showing ${progress + 1}/${hlCount}` : ""
            }`}
          >
            <HighlighterIcon
              className={cn(
                "h-2.5 w-2.5 transition-colors",
                progress >= 0 ? "text-primary" : "text-primary/50",
              )}
            />
            {Array.from({ length: Math.min(hlCount, 10) }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-all duration-200",
                  i <= progress
                    ? "scale-110 bg-primary"
                    : progress >= 0
                      ? "bg-muted-foreground/25"
                      : "bg-primary/40",
                )}
              />
            ))}
          </span>
        )}
      </div>
    </div>
  );
},
(prev, next) => {
  if (prev.slide.id !== next.slide.id) return false;
  if (prev.slide.code !== next.slide.code) return false;
  if (prev.slide.name !== next.slide.name) return false;
  if (prev.slide.language !== next.slide.language) return false;
  if ((prev.slide.highlights?.length ?? 0) !== (next.slide.highlights?.length ?? 0))
    return false;
  if (prev.index !== next.index) return false;
  if (prev.isOverlay !== next.isOverlay) return false;
  if (prev.isActive !== next.isActive) return false;
  if (prev.isRenaming !== next.isRenaming) return false;
  if (prev.renameValue !== next.renameValue) return false;
  if (prev.highlightProgress !== next.highlightProgress) return false;
  if (prev.style !== next.style) return false;
  if (prev.dragHandleProps !== next.dragHandleProps) return false;
  return true;
});

function SortableSlideItem({
  slide,
  index,
  onRemove,
  onRename,
  isDraggingId,
  isRenaming,
  renameValue,
  highlightProgress,
  onRenameValueChange,
  onCommitRename,
  onCancelRename,
}: {
  slide: Slide;
  index: number;
  onRemove: (id: string) => void;
  onRename: (id: string, current: string) => void;
  isDraggingId: string | null;
  isRenaming: boolean;
  renameValue: string;
  highlightProgress?: number;
  onRenameValueChange: (v: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: slide.id,
    animateLayoutChanges: () => false,
    disabled: isRenaming,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? undefined : transition,
    zIndex: isDragging ? 5 : 1,
  };

  return (
    <SlideCard
      slide={slide}
      index={index}
      isActive={isDraggingId === slide.id}
      isRenaming={isRenaming}
      renameValue={renameValue}
      highlightProgress={highlightProgress}
      onRenameValueChange={onRenameValueChange}
      onCommitRename={onCommitRename}
      onCancelRename={onCancelRename}
      onRemove={onRemove}
      onRename={onRename}
      setNodeRef={setNodeRef}
      style={style}
      dragHandleProps={{ ...attributes, ...listeners }}
    />
  );
}

export function BottomSlidesPanel({
  project,
  collapsed,
  activeHighlightIndex = -1,
  onToggleCollapse,
}: BottomSlidesPanelProps) {
  const setCurrentSlideId = useUiStore((s) => s.setCurrentSlideId);
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
  const restoreSlide = useRestoreSlide(project.id);
  const reorder = useReorderSlides(project.id);
  const updateSettings = useUpdateSlideSettings(project.id);

  const [ordered, setOrdered] = useState<Slide[]>(project.slides);
  useEffect(() => {
    setOrdered(project.slides);
  }, [project.slides]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

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

  const ids = useMemo(() => ordered.map((s) => s.id), [ordered]);

  // --- Virtualizer setup ---
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: ordered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_SIZE,
    horizontal: true,
    overscan: 10,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const isDragging = activeId !== null;
  const shouldVirtualize = ordered.length > 20 && !isDragging;

  // Auto-scroll to renaming slide / current slide
  useEffect(() => {
    if (!renamingId) return;
    const idx = ordered.findIndex((s) => s.id === renamingId);
    if (idx >= 0) {
      rowVirtualizer.scrollToIndex(idx, { align: "center", behavior: "smooth" });
    }
  }, [renamingId, ordered, rowVirtualizer]);

  useEffect(() => {
    if (!currentSlideId) return;
    // Only auto-scroll if the current slide is outside viewport
    const idx = ordered.findIndex((s) => s.id === currentSlideId);
    if (idx < 0) return;
    const vItems = rowVirtualizer.getVirtualItems();
    const isVisible = vItems.some((v) => v.index === idx);
    if (!isVisible) {
      rowVirtualizer.scrollToIndex(idx, { align: "auto", behavior: "smooth" });
    }
  }, [currentSlideId, ordered, rowVirtualizer]);

  const onDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      if (!over || active.id === over.id) return;

      const oldIndex = ordered.findIndex((s) => s.id === active.id);
      const newIndex = ordered.findIndex((s) => s.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;

      const previous = ordered;
      const next = arrayMove(ordered, oldIndex, newIndex);
      setOrdered(next);
      reorder.mutate(
        next.map((s) => s.id),
        {
          onError: () => setOrdered(previous),
        },
      );
    },
    [ordered, reorder],
  );

  const onDragCancel = useCallback(() => setActiveId(null), []);

  const startRename = useCallback((id: string, current: string) => {
    setRenamingId(id);
    setRenameValue(current);
  }, []);

  const commitRename = useCallback(() => {
    if (!renamingId) return;
    const name = renameValue.trim() || "Untitled slide";
    const id = renamingId;
    updateSettings.mutate(
      { slideId: id, payload: { name } },
      {
        onSuccess: () => {
          setOrdered((items) =>
            items.map((s) => (s.id === id ? { ...s, name } : s)),
          );
        },
        onSettled: () => setRenamingId(null),
      },
    );
  }, [renamingId, renameValue, updateSettings]);

  const handleRemove = useCallback(
    (id: string) => {
      if (ordered.length <= 1) return;
      const index = ordered.findIndex((s) => s.id === id);
      const snapshot = ordered[index];
      if (!snapshot) return;

      deleteSlide.mutate(id, {
        onSuccess: (proj) => {
          if (currentSlideId === id) {
            const fallback =
              proj.settings.currentSlideId ?? proj.slides[0]?.id ?? null;
            setCurrentSlideId(fallback);
          }
          notify.message("Slide deleted", {
            description: slideDisplayName(snapshot, index),
            action: {
              label: "Undo",
              onClick: () => {
                restoreSlide.mutate({
                  slide: snapshot,
                  insertAt: index,
                });
              },
            },
          });
        },
      });
    },
    [ordered, deleteSlide, restoreSlide, currentSlideId, setCurrentSlideId],
  );

  const handleAdd = useCallback(() => {
    const nextNum = ordered.length + 1;
    createSlide.mutate(
      { name: `Slide ${nextNum}` },
      {
        onSuccess: (slide) => {
          setCurrentSlideId(slide.id);
          // Scroll new slide into view after it appears
          requestAnimationFrame(() => {
            const idx = ordered.length; // appended at end
            rowVirtualizer.scrollToIndex(idx, { align: "end", behavior: "smooth" });
          });
        },
      },
    );
  }, [ordered.length, createSlide, setCurrentSlideId, rowVirtualizer]);

  if (isCollapsed) {
    return (
      <div
        className="flex h-full min-h-[36px] w-full cursor-pointer items-center justify-center bg-card/60 px-2 hover:bg-muted/30"
        onClick={toggleCollapse}
        title="Expand slides (or drag the handle above)"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleCollapse();
          }
        }}
      >
        <span className="inline-flex max-w-full items-center gap-1.5 truncate text-xs text-muted-foreground">
          <ChevronUp className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Slides ({ordered.length})</span>
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-card/60">
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-1">
        <span
          className="min-w-0 truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
          title="Slides"
        >
          Slides ({ordered.length}
          {shouldVirtualize ? ` · virtualized ${virtualItems.length}/${ordered.length} mounted` : ""})
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 text-xs"
            onClick={handleAdd}
            disabled={createSlide.isPending}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Add</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={toggleCollapse}>
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
          <div
            ref={parentRef}
            className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden"
            style={{ touchAction: "pan-x" }}
          >
            {shouldVirtualize ? (
              <div
                className="relative h-full"
                style={{ width: `${totalSize}px` }}
              >
                {virtualItems.map((virtualRow) => {
                  const slide = ordered[virtualRow.index];
                  if (!slide) return null;
                  return (
                    <div
                      key={slide.id}
                      data-index={virtualRow.index}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: `${ITEM_WIDTH}px`,
                        height: "100%",
                        transform: `translateX(${virtualRow.start}px)`,
                      }}
                    >
                      <SortableSlideItem
                        slide={slide}
                        index={virtualRow.index}
                        onRemove={handleRemove}
                        onRename={startRename}
                        isDraggingId={activeId}
                        isRenaming={renamingId === slide.id}
                        renameValue={renameValue}
                        highlightProgress={activeHighlightIndex}
                        onRenameValueChange={setRenameValue}
                        onCommitRename={commitRename}
                        onCancelRename={() => setRenamingId(null)}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 gap-2 overflow-x-auto overflow-y-hidden px-3 pb-3 pt-0.5">
                {ordered.map((slide, index) => (
                  <SortableSlideItem
                    key={slide.id}
                    slide={slide}
                    index={index}
                    onRemove={handleRemove}
                    onRename={startRename}
                    isDraggingId={activeId}
                    isRenaming={renamingId === slide.id}
                    renameValue={renameValue}
                    highlightProgress={activeHighlightIndex}
                    onRenameValueChange={setRenameValue}
                    onCommitRename={commitRename}
                    onCancelRename={() => setRenamingId(null)}
                  />
                ))}
              </div>
            )}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeSlide ? (
            <SlideCard slide={activeSlide} index={activeIndex} isOverlay />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
