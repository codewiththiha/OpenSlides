import { DragHandle } from "../ui/drag-handle";
import { InlineEditableText } from "../ui/inline-editable-text";

interface SlideCardHeaderProps {
  isRenaming: boolean;
  renameValue: string;
  title: string;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  onRenameValueChange?: (v: string) => void;
  onCommitRename?: () => void;
  onCancelRename?: () => void;
  onRename?: (id: string, current: string) => void;
  slideId: string;
}

export function SlideCardHeader({
  isRenaming,
  renameValue,
  title,
  dragHandleProps,
  onRenameValueChange,
  onCommitRename,
  onCancelRename,
  onRename,
  slideId,
}: SlideCardHeaderProps) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-1">
      <div className="flex min-w-0 items-center gap-1">
        <DragHandle
          {...dragHandleProps}
          onClick={(e) => e.stopPropagation()}
          aria-label="Drag to reorder slide"
        />
        {isRenaming ? (
          <InlineEditableText
            value={renameValue}
            onChange={(v) => onRenameValueChange?.(v)}
            onCommit={() => onCommitRename?.()}
            onCancel={() => onCancelRename?.()}
            className="h-5 min-w-0 flex-1 rounded px-1 text-xs font-medium"
          />
        ) : (
          <span
            className="truncate text-xs font-medium"
            title={`${title} — double-click or right-click to rename`}
            onDoubleClick={(e) => {
              if (!onRename) return;
              e.stopPropagation();
              onRename(slideId, title);
            }}
          >
            {title}
          </span>
        )}
      </div>
    </div>
  );
}
