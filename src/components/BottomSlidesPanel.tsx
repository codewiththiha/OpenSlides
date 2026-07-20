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
import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import { useDebounce } from "use-debounce";
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
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Pencil,
  Highlighter as HighlighterIcon,
  Copy,
  Search,
  X,
} from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/lib/tauri-api";
import { resolveProjectLanguage, slideDisplayName, themeBackground, type Project, type Slide } from "@/types";
import { useSlideThumbnail } from "@/hooks/useSlideThumbnail";
import { useUiStore } from "@/store/useUiStore";
import { useLocalCodeAtom } from "@/store/localCodeAtoms";
import { notify } from "@/lib/toast";
import {
  useCreateSlide,
  useDeleteSlide,
  useDuplicateSlide,
  useReorderSlides,
  useRestoreSlide,
  useUpdateSlideSettings,
} from "@/hooks/queries";

const ITEM_WIDTH = 152;

function SearchSnippet({ code, query }: { code: string; query: string }) {
  const q = query.trim();
  const lines = useMemo(() => code.split("\\n"), [code]);
  const lineStarts = useMemo(() => {
    const starts = [0];
    for (let i = 0; i < lines.length - 1; i++) {
      starts.push(starts[i] + lines[i].length + 1);
    }
    return starts;
  }, [lines]);
  const match = useMemo(() => code.toLowerCase().indexOf(q.toLowerCase()), [code, q]);
  if (!q || match < 0) return null;
  const lineIndex = lineStarts.findIndex((start, index) =>
    match < start + lines[index].length + 1,
  );
  const visible = lines.slice(Math.max(0, lineIndex - 2), lineIndex + 3);
  const firstVisible = Math.max(0, lineIndex - 2);
  return (
    <pre className="mt-1 max-h-8 overflow-hidden whitespace-pre-wrap break-words text-[9px] leading-tight text-muted-foreground" aria-label="Search match">
      {firstVisible > 0 && "…\\n"}
      {visible.map((line, index) => {
        const absolute = firstVisible + index;
        if (absolute !== lineIndex) return <span key={absolute}>{line}{index < visible.length - 1 ? "\\n" : ""}</span>;
        const lineStart = lineStarts[absolute] ?? 0;
        const from = Math.max(0, match - lineStart);
        const to = Math.min(line.length, from + q.length);
        return <span key={absolute}>{line.slice(0, from)}<mark className="rounded bg-primary/30 text-foreground">{line.slice(from, to)}</mark>{line.slice(to)}{index < visible.length - 1 ? "\\n" : ""}</span>;
      })}
      {firstVisible + visible.length < lines.length && "\\n…"}
    </pre>
  );
}

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
  onDuplicate?: (id: string) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  setNodeRef?: (node: HTMLElement | null) => void;
  registerCardRef?: (node: HTMLElement | null) => void;
  navigationIds?: string[];
  cardRefs?: React.MutableRefObject<Map<string, HTMLDivElement>>;
  isTabStop?: boolean;
  theme: string;
  language: string;
  searchQuery?: string;
  tooltipRight?: boolean;
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
  onDuplicate,
  dragHandleProps,
  setNodeRef,
  registerCardRef,
  navigationIds = [],
  cardRefs,
  isTabStop = false,
  theme,
  language,
  searchQuery = "",
  tooltipRight = false,
  style,
}: SlideCardProps) {
  // Per-slide atom: only this card re-renders when its own local code changes
  const codeOverride = useLocalCodeAtom(slide.id);
  // Boolean selector: only 2 cards re-render on slide switch (prev/new)
  const isSelected = useUiStore((s) => s.currentSlideId === slide.id);
  const setCurrentSlideId = useUiStore((s) => s.setCurrentSlideId);

  const thumbnailCode = codeOverride ?? slide.code;
  const preview = thumbnailCode.split("\n")[0]?.slice(0, 28) || "Empty";
  const [showHoverPreview, setShowHoverPreview] = useState(false);
  const hoverTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (hoverTimerRef.current !== null) window.clearTimeout(hoverTimerRef.current);
  }, []);
  const thumbnail = useSlideThumbnail({
    slideId: slide.id,
    code: thumbnailCode,
    theme,
    language,
    initialHtml: slide.thumbnailHtml,
  });
  const hoverThumbnail = useSlideThumbnail({
    slideId: slide.id,
    code: thumbnailCode,
    theme,
    language,
    maxLines: 10,
    maxChars: 1000,
    enabled: showHoverPreview,
  });
  const title = slideDisplayName(slide, index);
  const hlCount = slide.highlights?.length ?? 0;
  const progress = isSelected ? highlightProgress : -1;

  const handleCardKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || isOverlay || isRenaming) return;

    if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "Home" || e.key === "End") {
      e.preventDefault();
      e.stopPropagation();
      if (!cardRefs || navigationIds.length === 0) return;
      const currentIndex = navigationIds.indexOf(slide.id);
      const nextIndex = e.key === "Home"
        ? 0
        : e.key === "End"
          ? navigationIds.length - 1
          : (currentIndex + (e.key === "ArrowRight" ? 1 : -1) + navigationIds.length) % navigationIds.length;
      const next = cardRefs.current.get(navigationIds[nextIndex]);
      next?.focus();
      next?.scrollIntoView({ inline: "nearest", block: "nearest" });
      return;
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      setCurrentSlideId(slide.id);
      return;
    }

    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      e.stopPropagation();
      onRemove?.(slide.id);
      return;
    }

    if (e.key === "F2") {
      e.preventDefault();
      e.stopPropagation();
      onRename?.(slide.id, title);
    }
  };

  return (
    <div
      ref={(node) => {
        setNodeRef?.(node);
        registerCardRef?.(node);
      }}
      data-slide-id={slide.id}
      role="option"
      aria-selected={isSelected}
      tabIndex={isTabStop ? 0 : -1}
      onKeyDown={handleCardKeyDown}
      className={cn(
        "group relative flex h-full shrink-0 cursor-pointer flex-col gap-1 rounded-md border p-2 select-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
        "will-change-transform min-w-0",
        isOverlay
          ? "cursor-grabbing border-primary bg-card shadow-xl ring-2 ring-primary/40"
          : isSelected
            ? "border-primary/50 bg-muted ring-1 ring-primary/20"
            : "bg-background/60 hover:border-primary/30 hover:bg-muted/40",
        isActive && !isOverlay && "opacity-30",
      )}
      style={{ width: ITEM_WIDTH, ...style }}
      onMouseEnter={() => {
        if (isOverlay) return;
        hoverTimerRef.current = window.setTimeout(() => setShowHoverPreview(true), 300);
      }}
      onMouseLeave={() => {
        if (hoverTimerRef.current !== null) window.clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
        setShowHoverPreview(false);
      }}
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
    >
      {showHoverPreview && hoverThumbnail.html && (
        <div
          ref={hoverThumbnail.ref}
          className={cn(
            "pointer-events-none absolute bottom-full z-50 mb-2 h-[170px] w-[300px] overflow-hidden rounded-lg border border-border bg-card p-2 shadow-2xl",
            tooltipRight ? "right-0" : "left-0",
          )}
          style={{ backgroundColor: themeBackground(theme) }}
          aria-hidden="true"
        >
          <code
            className="block font-mono"
            style={{ fontSize: "8px", lineHeight: 1.35, whiteSpace: "pre" }}
            dangerouslySetInnerHTML={{ __html: hoverThumbnail.html }}
          />
        </div>
      )}
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
            {onDuplicate && (
              <button
                type="button"
                className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                title="Duplicate slide (Cmd+Shift+D)"
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate(slide.id);
                }}
              >
                <Copy className="h-3 w-3" />
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
        ref={thumbnail.ref}
        className={cn(
          "relative w-full overflow-hidden rounded border border-border/70 p-1",
          isSelected && "ring-1 ring-primary/30",
        )}
        style={{ aspectRatio: "16 / 9", backgroundColor: themeBackground(theme) }}
        aria-hidden="true"
      >
        {thumbnail.html ? (
          <code
            className="pointer-events-none block overflow-hidden font-mono"
            style={{
              fontSize: "5.5px",
              lineHeight: 1.35,
              whiteSpace: "pre",
            }}
            dangerouslySetInnerHTML={{ __html: thumbnail.html }}
          />
        ) : (
          <span className="block truncate font-mono text-[10px] leading-tight text-muted-foreground/80">
            {preview}
          </span>
        )}
      </div>
      {searchQuery && <SearchSnippet code={`${title}\n${thumbnailCode}`} query={searchQuery} />}
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
  // Custom comparator: only re-render if relevant fields changed
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
  if (prev.isTabStop !== next.isTabStop) return false;
  if (prev.navigationIds !== next.navigationIds) return false;
  if (prev.theme !== next.theme) return false;
  if (prev.language !== next.language) return false;
  if (prev.searchQuery !== next.searchQuery) return false;
  if (prev.tooltipRight !== next.tooltipRight) return false;
  // style reference changes often during drag, check shallow
  if (prev.style !== next.style) return false;
  // dragHandleProps is stable from useSortable, but compare ref
  if (prev.dragHandleProps !== next.dragHandleProps) return false;
  // on* callbacks are stable via useCallback, ignore
  return true;
});

function SortableSlideItem({
  slide,
  index,
  onRemove,
  onRename,
  onDuplicate,
  isDraggingId,
  isRenaming,
  renameValue,
  highlightProgress,
  onRenameValueChange,
  onCommitRename,
  onCancelRename,
  registerCardRef,
  navigationIds,
  cardRefs,
  isTabStop,
  theme,
  language,
  searchQuery,
  tooltipRight,
}: {
  slide: Slide;
  index: number;
  onRemove: (id: string) => void;
  onRename: (id: string, current: string) => void;
  onDuplicate: (id: string) => void;
  isDraggingId: string | null;
  isRenaming: boolean;
  renameValue: string;
  highlightProgress?: number;
  onRenameValueChange: (v: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  registerCardRef: (id: string, node: HTMLDivElement | null) => void;
  navigationIds: string[];
  cardRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  isTabStop: boolean;
  theme: string;
  language: string;
  searchQuery: string;
  tooltipRight: boolean;
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
  const combinedRef = (node: HTMLElement | null) => {
    setNodeRef(node);
    registerCardRef(slide.id, node as HTMLDivElement | null);
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
      onDuplicate={onDuplicate}
      setNodeRef={combinedRef}
      navigationIds={navigationIds}
      cardRefs={cardRefs}
      isTabStop={isTabStop}
      theme={theme}
      language={language}
      searchQuery={searchQuery}
      tooltipRight={tooltipRight}
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
  const duplicateSlide = useDuplicateSlide(project.id);
  const restoreSlide = useRestoreSlide(project.id);
  const reorder = useReorderSlides(project.id);
  const updateSettings = useUpdateSlideSettings(project.id);
  const theme = project.theme;
  const language = resolveProjectLanguage(project);

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

  const [rawSearchQuery, setRawSearchQuery] = useState("");
  const [debouncedSearchQuery] = useDebounce(rawSearchQuery, 180);
  // Keep clearing instant while filtering waits until typing pauses.
  const searchQuery = rawSearchQuery.trim() ? debouncedSearchQuery : "";
  const [searchResultIds, setSearchResultIds] = useState<Set<string> | null>(null);
  useEffect(() => {
    let cancelled = false;
    setSearchResultIds(null);
    if (!searchQuery.trim()) return;
    api.searchSlides(project.id, searchQuery).then((ids) => {
      if (!cancelled) setSearchResultIds(new Set(ids));
    }).catch(() => {
      // Browser preview or older databases can fall back to the local index.
      if (!cancelled) setSearchResultIds(null);
    });
    return () => { cancelled = true; };
  }, [project.id, searchQuery]);
  const filteredOrdered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ordered;
    if (searchResultIds) return ordered.filter((slide) => searchResultIds.has(slide.id));
    // Only build the JS fallback index if FTS is unavailable.
    return ordered
      .map((slide) => ({ slide, haystack: `${slide.name ?? ""}\n${slide.code}`.toLowerCase() }))
      .filter(({ haystack }) => haystack.includes(q))
      .map(({ slide }) => slide);
  }, [ordered, searchQuery, searchResultIds]);

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
            className="h-6 w-full rounded-md border border-input bg-background pl-6 pr-6 text-xs outline-none focus:ring-1 focus:ring-ring"
            placeholder="Search by name or code…"
            value={rawSearchQuery}
            onChange={(e) => setRawSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-muted"
              onClick={() => setRawSearchQuery("")}
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
                  tooltipRight={index >= filteredOrdered.length - 2}
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
