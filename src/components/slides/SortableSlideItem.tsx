import { useSortable } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { SlideCard } from "./SlideCard";
import { StackDeck } from "../ui/stack/StackDeck";
import { cn } from "@/lib/utils";
import type { Slide } from "@/types";

export function SortableSlideItem({
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
  enableHoverPreview,
  isStack,
  count = 1,
  onExpand,
  onOpenTop,
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
  enableHoverPreview: boolean;
  isStack?: boolean;
  count?: number;
  onExpand?: () => void;
  onOpenTop?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
    isOver: isOverSortable,
  } = useSortable({
    id: slide.id,
    animateLayoutChanges: () => false,
    disabled: isRenaming,
  });

  const {
    setNodeRef: setStackTargetRef,
    isOver: isOverStackTarget,
  } = useDroppable({
    id: `stack-target-${slide.id}`,
    data: {
      kind: "slide-stack-target",
      targetId: slide.id,
    },
    disabled: Boolean(isDraggingId === slide.id || isRenaming || searchQuery.trim().length > 0),
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? undefined : transition,
    zIndex: isDragging ? 5 : 1,
  };

  const combinedRef = (node: HTMLElement | null) => {
    setSortableRef(node);
  };

  const combinedCardRef = (node: HTMLElement | null) => {
    registerCardRef(slide.id, node as HTMLDivElement | null);
  };

  const isReorderHover = isOverSortable && !isOverStackTarget && isDraggingId && isDraggingId !== slide.id;

  return (
    <div
      ref={combinedRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "relative select-none transition-all duration-150",
        isReorderHover && "border-l-2 border-primary pl-1"
      )}
    >
      {/* Center 50% stack drop zone */}
      <div
        ref={setStackTargetRef}
        className={cn(
          "absolute inset-y-1 left-1/4 right-1/4 z-30 transition-all duration-150",
          isOverStackTarget
            ? "rounded-lg ring-2 ring-primary ring-offset-1 ring-offset-background bg-primary/20 scale-95 shadow-md pointer-events-auto"
            : "pointer-events-none"
        )}
        style={{ pointerEvents: isDraggingId && isDraggingId !== slide.id ? "auto" : "none" }}
      />

      {isStack && count > 1 ? (
        <StackDeck
          count={count}
          variant="slide"
          onExpand={onExpand}
          onOpenTop={onOpenTop}
        >
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
            setNodeRef={combinedCardRef}
            navigationIds={navigationIds}
            cardRefs={cardRefs}
            isTabStop={isTabStop}
            theme={theme}
            language={language}
            searchQuery={searchQuery}
            enableHoverPreview={enableHoverPreview}
          />
        </StackDeck>
      ) : (
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
          setNodeRef={combinedCardRef}
          navigationIds={navigationIds}
          cardRefs={cardRefs}
          isTabStop={isTabStop}
          theme={theme}
          language={language}
          searchQuery={searchQuery}
          enableHoverPreview={enableHoverPreview}
        />
      )}
    </div>
  );
}

