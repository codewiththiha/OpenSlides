import { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GripVertical, Pencil, Copy, Trash2, Highlighter as HighlighterIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { slideDisplayName, type Slide } from "@/types";
import { useSlideThumbnail } from "@/hooks/useSlideThumbnail";
import { useUiStore } from "@/store/useUiStore";
import { useSlideCode } from "@/hooks/useSlideCode";
import { SearchSnippet } from "./SearchSnippet";
import { Z_INDEX } from "../ui/overlay";
import { CodeThumbnail } from "../ui/code-thumbnail";
import { InlineRenameInput } from "../ui/inline-rename-input";

export const ITEM_WIDTH = 152;

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
  navigationIds?: string[];
  cardRefs?: React.MutableRefObject<Map<string, HTMLDivElement>>;
  isTabStop?: boolean;
  theme: string;
  language: string;
  searchQuery?: string;
  enableHoverPreview?: boolean;
  style?: React.CSSProperties;
}

export const SlideCard = memo(function SlideCard({
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
  navigationIds = [],
  cardRefs,
  isTabStop = false,
  theme,
  language,
  searchQuery = "",
  enableHoverPreview = false,
  style,
}: SlideCardProps) {
  const isSelected = useUiStore((s) => s.currentSlideId === slide.id);
  const setCurrentSlideId = useUiStore((s) => s.setCurrentSlideId);
  const thumbnailCode = useSlideCode(slide.id, slide.code);
  const preview = thumbnailCode.split("\n")[0]?.slice(0, 28) || "Empty";
  const [showHoverPreview, setShowHoverPreview] = useState(false);
  const [hoverPosition, setHoverPosition] = useState({ left: 8, top: 8 });
  const hoverTimerRef = useRef<number | null>(null);
  const cardRootRef = useRef<HTMLDivElement | null>(null);
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
    enabled: showHoverPreview && enableHoverPreview,
    priority: "high",
    debounceMs: 80,
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
        cardRootRef.current = node;
        setNodeRef?.(node);
      }}
      data-slide-id={slide.id}
      role="option"
      aria-selected={isSelected}
      tabIndex={isTabStop ? 0 : -1}
      onKeyDown={handleCardKeyDown}
      className={cn(
        "group relative flex h-full shrink-0 cursor-pointer flex-col gap-1 overflow-hidden rounded-md border p-2 select-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
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
          if (isOverlay || !enableHoverPreview) return;
        hoverTimerRef.current = window.setTimeout(() => {
          const rect = cardRootRef.current?.getBoundingClientRect();
          if (!rect) return;
          const width = 300;
          const height = 170;
          const left = Math.min(
            Math.max(8, rect.left),
            Math.max(8, window.innerWidth - width - 8),
          );
          const above = rect.top - height - 8;
          const top = above >= 8
            ? above
            : Math.min(rect.bottom + 8, window.innerHeight - height - 8);
          setHoverPosition({ left, top: Math.max(8, top) });
          setShowHoverPreview(true);
        }, 300);
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
      {showHoverPreview && hoverThumbnail.html && createPortal(
        <CodeThumbnail
          containerRef={hoverThumbnail.ref}
          html={hoverThumbnail.html}
          theme={theme}
          fontSize={8}
          className="pointer-events-none fixed h-[170px] w-[300px] rounded-lg border border-border bg-card p-2 shadow-2xl"
          style={{ left: hoverPosition.left, top: hoverPosition.top, zIndex: Z_INDEX.hoverPreview }}
        />,
        document.body,
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
            <InlineRenameInput
              value={renameValue}
              onChange={(v) => onRenameValueChange?.(v)}
              onCommit={() => onCommitRename?.()}
              onCancel={() => onCancelRename?.()}
              className="h-5 min-w-0 flex-1 rounded border border-input bg-background px-1 text-xs font-medium outline-none focus:ring-1 focus:ring-ring"
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
      <CodeThumbnail
        containerRef={thumbnail.ref}
        html={thumbnail.html}
        theme={theme}
        fontSize={5.5}
        className={cn(
          "rounded border border-border/70 p-1",
          isSelected && "ring-1 ring-primary/30",
        )}
        style={{ aspectRatio: "16 / 9" }}
        fallback={
          <span className="block truncate font-mono text-[10px] leading-tight text-muted-foreground/80">
            {preview}
          </span>
        }
      />
      {searchQuery && <SearchSnippet code={`${title}\n${thumbnailCode}`} query={searchQuery} />}
      <div className="mt-auto flex items-center justify-between gap-1">
        <span
          className="truncate text-[10px] text-muted-foreground/70"
          title={slide.language}
        >
          {slide.language}
        </span>
        {hlCount > 0 && (
          <span className="relative grid shrink-0 place-items-center">
            <span
              className={cn(
                "col-start-1 row-start-1 inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-[3px]",
                "text-[8px] font-semibold leading-none text-primary/70",
                "transition-opacity duration-150",
                "group-hover:opacity-0",
                (isSelected || progress >= 0) && "opacity-0",
              )}
            >
              <HighlighterIcon className="h-2.5 w-2.5" />
              {hlCount}
            </span>
            <span
              className={cn(
                "col-start-1 row-start-1 inline-flex items-center gap-[3px] rounded bg-primary/10 px-1.5 py-[3px]",
                "opacity-0 transition-opacity duration-150",
                "group-hover:opacity-100",
                (isSelected || progress >= 0) && "opacity-100",
              )}
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
    if (prev.enableHoverPreview !== next.enableHoverPreview) return false;
  // style reference changes often during drag, check shallow
  if (prev.style !== next.style) return false;
  // dragHandleProps is stable from useSortable, but compare ref
  if (prev.dragHandleProps !== next.dragHandleProps) return false;
  // on* callbacks are stable via useCallback, ignore
  return true;
});

