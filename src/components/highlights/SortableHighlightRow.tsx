import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DragHandle } from "../ui/drag-handle";

export function SortableHighlightRow({ id, disabled, children }: { id: string; disabled: boolean; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id, disabled });
  const handle = (
    <DragHandle
      iconClassName="h-3 w-3"
      disabled={disabled}
      aria-label="Drag to reorder highlight"
      {...attributes}
      {...listeners}
      onClick={(e) => e.stopPropagation()}
    />
  );
  return <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }}>{children(handle)}</div>;
}
