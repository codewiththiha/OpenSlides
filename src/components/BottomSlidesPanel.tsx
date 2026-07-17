/**
 * Horizontal slide strip with smooth drag-and-drop reorder.
 *
 * Performance notes:
 * - DragOverlay (portal) so the list itself only dims the source item
 * - CSS.Translate instead of full Transform matrix for cheaper compositing
 * - Optimistic local order so UI snaps instantly; SQLite reorder is async
 * - Labels truncate with ellipsis when the strip is short
 */
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import type { Project, Slide } from "@/types";
import { useUiStore } from "@/store/useUiStore";
import {
  useCreateSlide,
  useDeleteSlide,
  useReorderSlides,
} from "@/hooks/useProjectQueries";

const ITEM_WIDTH = 152;

interface BottomSlidesPanelProps {
  project: Project;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const dropAnimation: DropAnimation = {
  duration: 180,
  easing: "cubic-bezier(0.25, 1, 0.5, 1)",
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0.4" } },
  }),
};

function SlideCard({
  slide,
  index,
  isOverlay = false,
  isActive = false,
  onRemove,
  dragHandleProps,
  setNodeRef,
  style,
}: {
  slide: Slide;
  index: number;
  isOverlay?: boolean;
  isActive?: boolean;
  onRemove?: (id: string) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  setNodeRef?: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
}) {
  const { currentSlideId, setCurrentSlideId, localCode } = useUiStore();
  const preview =
    (localCode[slide.id] ?? slide.code).split("\n")[0]?.slice(0, 28) || "Empty";
  const selected = currentSlideId === slide.id;

  return (
    <div
      ref={setNodeRef}
      style={{ width: ITEM_WIDTH, ...style }}
      onClick={() => !isOverlay && setCurrentSlideId(slide.id)}
      className={cn(
        "group relative flex h-full shrink-0 cursor-pointer flex-col gap-1 rounded-md border p-2 select-none",
        "will-change-transform min-w-0",
        isOverlay
          ? "cursor-grabbing border-primary bg-card shadow-xl ring-2 ring-primary/40"
          : selected
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
          <span className="truncate text-xs font-medium" title={`Slide ${index + 1}`}>
            Slide {index + 1}
          </span>
        </div>
        {!isOverlay && onRemove && (
          <button
            type="button"
            className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(slide.id);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
      <div
        className="truncate font-mono text-[10px] leading-tight text-muted-foreground"
        title={preview}
      >
        {preview}
      </div>
      <div className="mt-auto truncate text-[10px] text-muted-foreground/70" title={slide.language}>
        {slide.language}
      </div>
    </div>
  );
}

function SortableSlideItem({
  slide,
  index,
  onRemove,
  isDraggingId,
}: {
  slide: Slide;
  index: number;
  onRemove: (id: string) => void;
  isDraggingId: string | null;
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
      onRemove={onRemove}
      setNodeRef={setNodeRef}
      style={style}
      dragHandleProps={{ ...attributes, ...listeners }}
    />
  );
}

export function BottomSlidesPanel({
  project,
  collapsed,
  onToggleCollapse,
}: BottomSlidesPanelProps) {
  const {
    setCurrentSlideId,
    currentSlideId,
    isBottomPanelCollapsed,
    setIsBottomPanelCollapsed,
  } = useUiStore();

  const isCollapsed = collapsed ?? isBottomPanelCollapsed;
  const toggleCollapse =
    onToggleCollapse ?? (() => setIsBottomPanelCollapsed(!isBottomPanelCollapsed));

  const createSlide = useCreateSlide(project.id);
  const deleteSlide = useDeleteSlide(project.id);
  const reorder = useReorderSlides(project.id);

  const [ordered, setOrdered] = useState<Slide[]>(project.slides);
  useEffect(() => {
    setOrdered(project.slides);
  }, [project.slides]);

  const [activeId, setActiveId] = useState<string | null>(null);
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

  const onDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      if (!over || active.id === over.id) return;

      setOrdered((items) => {
        const oldIndex = items.findIndex((s) => s.id === active.id);
        const newIndex = items.findIndex((s) => s.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return items;
        const next = arrayMove(items, oldIndex, newIndex);
        reorder.mutate(next.map((s) => s.id));
        return next;
      });
    },
    [reorder],
  );

  const onDragCancel = useCallback(() => setActiveId(null), []);

  const handleRemove = useCallback(
    (id: string) => {
      if (ordered.length <= 1) return;
      deleteSlide.mutate(id, {
        onSuccess: (proj) => {
          if (currentSlideId === id) {
            const fallback =
              proj.settings.currentSlideId ?? proj.slides[0]?.id ?? null;
            setCurrentSlideId(fallback);
          }
        },
      });
    },
    [ordered.length, deleteSlide, currentSlideId, setCurrentSlideId],
  );

  const handleAdd = () => {
    const language = project.slides[0]?.language || "typescript";
    createSlide.mutate(
      { language },
      {
        onSuccess: (slide) => setCurrentSlideId(slide.id),
      },
    );
  };

  if (isCollapsed) {
    return (
      <div className="flex h-full min-h-[32px] items-center justify-center bg-card/60">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 max-w-full gap-1 truncate text-xs text-muted-foreground"
          onClick={toggleCollapse}
        >
          <ChevronUp className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Slides ({ordered.length})</span>
        </Button>
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
          Slides
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
            className="flex min-h-0 flex-1 gap-2 overflow-x-auto overflow-y-hidden px-3 pb-3 pt-0.5"
            style={{ touchAction: "pan-x" }}
          >
            {ordered.map((slide, index) => (
              <SortableSlideItem
                key={slide.id}
                slide={slide}
                index={index}
                onRemove={handleRemove}
                isDraggingId={activeId}
              />
            ))}
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
