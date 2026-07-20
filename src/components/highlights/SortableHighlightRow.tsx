import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

export function SortableHighlightRow({ id, disabled, children }: { id: string; disabled: boolean; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id, disabled });
  const handle = <button type="button" className="shrink-0 cursor-grab touch-none rounded text-muted-foreground hover:bg-muted active:cursor-grabbing" disabled={disabled} {...attributes} {...listeners} aria-label="Drag to reorder highlight" onClick={(e) => e.stopPropagation()}><GripVertical className="h-3 w-3" /></button>;
  return <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }}>{children(handle)}</div>;
}
