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
  Plus,
  ChevronDown,
  ChevronUp,
  Search,
  X,
} from "lucide-react";
import { Button } from "./ui/button";
import { resolveProjectLanguage, slideDisplayName, type Project, type Slide } from "@/types";
import { modKeyLabel } from "@/lib/platform";
import { useSlideStripSearch } from "@/hooks/useSlideStripSearch";
import { SlideCard } from "./slides/SlideCard";
import { SortableSlideItem } from "./slides/SortableSlideItem";
import { useUiStore } from "@/store/useUiStore";
import { notify } from "@/lib/toast";
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
} from "@/hooks/queries";

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
  const duplicateSlide = useDuplicateSlide(project.id);
  const restoreSlide = useRestoreSlide(project.id);
  const reorder = useReorderSlides(project.id);
  const updateSettings = useUpdateSlideSettings(project.id);
  const theme = project.theme;
  const language = resolveProjectLanguage(project);

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
    [ordered, reorder, searchQuery],
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
      if (ordered.length <= 1 || renamingId) return;
      const index = ordered.findIndex((s) => s.id === id);
      const snapshot = ordered[index];
      if (!snapshot) return;
      pendingFocusId.current = ordered[index + 1]?.id ?? ordered[index - 1]?.id ?? null;

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
    [ordered, renamingId, deleteSlide, restoreSlide, currentSlideId, setCurrentSlideId],
  );

  const handleDuplicate = useCallback(
    (id: string) => {
      duplicateSlide.mutate(id);
    },
    [duplicateSlide],
  );

  const handleAdd = useCallback(() => {
    const nextNum = ordered.length + 1;
    createSlide.mutate(
      { name: `Slide ${nextNum}` },
      {
        onSuccess: (slide) => setCurrentSlideId(slide.id),
      },
    );
  }, [ordered.length, createSlide, setCurrentSlideId]);

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
      <div className="flex shrink-0 items-center gap-2 px-3 py-1">
        <span
          className="min-w-0 shrink-0 truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
          title="Slides"
        >
          Slides ({ordered.length}
          {searchQuery ? ` · ${filteredOrdered.length} filtered` : ""})
        </span>
        <div className="relative flex-1 mx-2">
          <Search className="absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchInputRef}
            className="h-6 w-full rounded-md border border-input bg-background pl-6 pr-6 text-xs outline-none focus:ring-1 focus:ring-ring"
            placeholder="Search by name or code…"
            title={`Search slides (${modKeyLabel()}⇧F or /)`}
            value={rawSearchQuery}
            onChange={(e) => setRawSearchQuery(e.target.value)}
            onKeyDown={(e) => {
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
          />
          {searchQuery && (
            <button
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-muted"
              onClick={clearSearch}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
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
            role="listbox"
            aria-label="Slides"
          >
            {filteredOrdered.map((slide, index) => {
              const originalIndex = ordered.findIndex((s) => s.id === slide.id);
              return (
                <SortableSlideItem
                  key={slide.id}
                  slide={slide}
                  index={originalIndex >= 0 ? originalIndex : index}
                  onRemove={handleRemove}
                  onRename={startRename}
                  onDuplicate={handleDuplicate}
                  isDraggingId={activeId}
                  isRenaming={renamingId === slide.id}
                  renameValue={renameValue}
                  highlightProgress={activeHighlightIndex}
                  onRenameValueChange={setRenameValue}
                  onCommitRename={commitRename}
                  onCancelRename={() => setRenamingId(null)}
                  registerCardRef={registerCardRef}
                  navigationIds={ids}
                  cardRefs={cardRefs}
                  isTabStop={slide.id === tabStopId}
                  theme={theme}
                  language={language}
                  searchQuery={searchQuery}
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
