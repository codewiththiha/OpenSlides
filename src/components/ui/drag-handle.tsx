import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface DragHandleProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Size override for the grip icon (default matches the slide strip). */
  iconClassName?: string;
}

/** Shared drag grip for dnd-kit sortable rows/cards. Spread the
 *  `{...attributes} {...listeners}` from useSortable onto it. */
export function DragHandle({
  className,
  iconClassName,
  ...props
}: DragHandleProps) {
  return (
    <button
      type="button"
      className={cn(
        "shrink-0 cursor-grab touch-none rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      {...props}
    >
      <GripVertical className={cn("h-3.5 w-3.5", iconClassName)} />
    </button>
  );
}
