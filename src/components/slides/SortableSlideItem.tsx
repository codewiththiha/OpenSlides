import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SlideCard } from "./SlideCard";
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
      enableHoverPreview={enableHoverPreview}
      style={style}
      dragHandleProps={{ ...attributes, ...listeners }}
    />
  );
}

