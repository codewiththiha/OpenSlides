import { memo, useRef } from "react";
import { cn } from "@/lib/utils";
import { slideDisplayName, themeBackground, type Slide } from "@/types";
import { useSlideThumbnail } from "@/hooks/useSlideThumbnail";
import { useUiStore } from "@/store/useUiStore";
import { useSlideCode } from "@/hooks/useSlideCode";
import { SearchSnippet } from "./SearchSnippet";
import { CodeThumbnail } from "../ui/code-thumbnail";
import { SlideCardHeader } from "./SlideCardHeader";
import { SlideCardActions } from "./SlideCardActions";
import { SlideCardMeta } from "./SlideCardMeta";
import { SlideCardHoverPreview } from "./SlideCardHoverPreview";
import { useSlideCardHoverPreview } from "./useSlideCardHoverPreview";

export const ITEM_WIDTH = 152;
export const ITEM_HEIGHT = 132;

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
  isMultiSelectMode?: boolean;
  isMultiSelected?: boolean;
  onToggleMultiSelect?: (id: string, position?: { x: number; y: number }) => void;
  onOpenContextMenu?: (event: React.MouseEvent<HTMLDivElement>, slide: Slide, title: string) => void;
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
  isMultiSelectMode = false,
  isMultiSelected = false,
  onToggleMultiSelect,
  onOpenContextMenu,
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
  const cardRootRef = useRef<HTMLDivElement | null>(null);
  const thumbnail = useSlideThumbnail({
    slideId: slide.id,
    code: thumbnailCode,
    theme,
    language,
    initialHtml: slide.thumbnailHtml,
  });
  const { showHoverPreview, hoverPosition, onMouseEnter, onMouseLeave } =
    useSlideCardHoverPreview({ isOverlay, enableHoverPreview, cardRootRef });
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
  const codeBackground = themeBackground(theme);
  // Theme backgrounds are six-digit hex values; the alpha suffix keeps the
  // title and metadata fades visually connected to the code preview.
  const softCodeBackground = `${codeBackground}e0`;

  const handleCardKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || isOverlay || isRenaming) return;

    if (isMultiSelectMode && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      e.stopPropagation();
      onToggleMultiSelect?.(slide.id);
      return;
    }

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
        "group relative flex h-[118px] shrink-0 self-center cursor-pointer flex-col gap-1 overflow-hidden rounded-md border p-2 select-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
        "will-change-transform min-w-0",
        isOverlay
          ? "cursor-grabbing border-primary bg-card shadow-xl ring-2 ring-primary/40"
          : isSelected
            ? "border-primary/50 bg-muted ring-1 ring-primary/20"
            : "bg-background/60 hover:border-primary/30 hover:bg-muted/40",
        isMultiSelected && "border-primary bg-primary/10 ring-2 ring-primary/30",
        isActive && !isOverlay && "opacity-30",
      )}
      style={{ width: ITEM_WIDTH, height: ITEM_HEIGHT, ...style }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={(event) => {
        if (isOverlay || isRenaming) return;
        if (isMultiSelectMode) {
          onToggleMultiSelect?.(slide.id, { x: event.clientX, y: event.clientY });
          return;
        }
        setCurrentSlideId(slide.id);
      }}
      onContextMenu={(e) => {
        if (isOverlay) return;
        e.preventDefault();
        e.stopPropagation();
        onOpenContextMenu?.(e, slide, title);
      }}
    >
      <CodeThumbnail
        containerRef={thumbnail.ref}
        html={thumbnail.html}
        theme={theme}
        fontSize={5.5}
        className={cn(
          "absolute inset-0 h-full w-full rounded-none border-0",
          isSelected && "ring-1 ring-primary/30",
        )}
        codeClassName="p-2 pt-9"
        fallback={
          <span className="block truncate p-2 pt-9 font-mono text-[10px] leading-tight text-muted-foreground/80">
            {preview}
          </span>
        }
      />

      <SlideCardHoverPreview
        show={showHoverPreview}
        html={hoverThumbnail.html}
        containerRef={hoverThumbnail.ref}
        theme={theme}
        left={hoverPosition.left}
        top={hoverPosition.top}
      />

      {/* The title sits over the code with a soft fade rather than taking layout space. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 px-2 pb-8 pt-2"
        style={{ background: `linear-gradient(to bottom, ${codeBackground} 0%, ${softCodeBackground} 45%, transparent 100%)` }}
      >
        <div className="pointer-events-auto pr-14">
          <SlideCardHeader
            isRenaming={isRenaming}
            renameValue={renameValue}
            title={title}
            dragHandleProps={dragHandleProps}
            onRenameValueChange={onRenameValueChange}
            onCommitRename={onCommitRename}
            onCancelRename={onCancelRename}
            onRename={onRename}
            slideId={slide.id}
          />
        </div>
      </div>

      <div className="absolute right-2 top-1.5 z-20">
        <SlideCardActions
          isOverlay={isOverlay}
          isRenaming={isRenaming}
          title={title}
          slideId={slide.id}
          onRename={onRename}
          onDuplicate={onDuplicate}
          onRemove={onRemove}
        />
      </div>

      {searchQuery && (
        <div className="absolute inset-x-2 bottom-7 z-10">
          <SearchSnippet code={`${title}\n${thumbnailCode}`} query={searchQuery} />
        </div>
      )}

      <div
        className="absolute inset-x-0 bottom-0 z-10 px-2 pb-1.5 pt-7"
        style={{ background: `linear-gradient(to top, ${codeBackground} 0%, ${softCodeBackground} 48%, transparent 100%)` }}
      >
        <SlideCardMeta
          language={language}
          hlCount={hlCount}
          progress={progress}
          isSelected={isSelected}
        />
      </div>
    </div>
  );
},
(prev, next) => {
  // Custom comparator: only re-render if relevant fields changed
  if (prev.slide.id !== next.slide.id) return false;
  if (prev.slide.code !== next.slide.code) return false;
  if (prev.slide.name !== next.slide.name) return false;
  if (prev.slide.sectionId !== next.slide.sectionId) return false;
  if ((prev.slide.highlights?.length ?? 0) !== (next.slide.highlights?.length ?? 0))
    return false;
  if (prev.index !== next.index) return false;
  if (prev.isOverlay !== next.isOverlay) return false;
  if (prev.isActive !== next.isActive) return false;
  if (prev.isRenaming !== next.isRenaming) return false;
  if (prev.renameValue !== next.renameValue) return false;
  if (prev.highlightProgress !== next.highlightProgress) return false;
  if (prev.isTabStop !== next.isTabStop) return false;
  if (prev.isMultiSelectMode !== next.isMultiSelectMode) return false;
  if (prev.isMultiSelected !== next.isMultiSelected) return false;
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
