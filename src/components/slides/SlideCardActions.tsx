import { Pencil, Copy, Trash2 } from "lucide-react";
import { HoverActions, HoverActionButton } from "../ui/hover-actions";

interface SlideCardActionsProps {
  isOverlay: boolean;
  isRenaming: boolean;
  title: string;
  slideId: string;
  onRename?: (id: string, current: string) => void;
  onDuplicate?: (id: string) => void;
  onRemove?: (id: string) => void;
}

export function SlideCardActions({
  isOverlay,
  isRenaming,
  title,
  slideId,
  onRename,
  onDuplicate,
  onRemove,
}: SlideCardActionsProps) {
  if (isOverlay || isRenaming) return null;

  return (
    <HoverActions>
      {onRename && (
        <HoverActionButton
          size="sm"
          title="Rename slide"
          onClick={(e) => {
            e.stopPropagation();
            onRename(slideId, title);
          }}
        >
          <Pencil className="h-3 w-3" />
        </HoverActionButton>
      )}
      {onDuplicate && (
        <HoverActionButton
          size="sm"
          title="Duplicate slide (Cmd+Shift+D)"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate(slideId);
          }}
        >
          <Copy className="h-3 w-3" />
        </HoverActionButton>
      )}
      {onRemove && (
        <HoverActionButton
          size="sm"
          destructive
          onClick={(e) => {
            e.stopPropagation();
            onRemove(slideId);
          }}
        >
          <Trash2 className="h-3 w-3" />
        </HoverActionButton>
      )}
    </HoverActions>
  );
}
