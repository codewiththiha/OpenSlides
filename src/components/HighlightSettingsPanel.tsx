import { useCallback, useEffect, useState } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { useHighlightSnippets } from "@/hooks/queries/highlights";
import { HighlightRow } from "./highlights/HighlightRow";
import { SortableHighlightRow } from "./highlights/SortableHighlightRow";
import type { Highlight } from "@/types";

export function HighlightSettingsPanel({ highlights, code, expandedId, previewIndex, onToggleExpand, onUpdate, onDelete, onPreview, onMove, onReorder }: { highlights: Highlight[]; code: string; expandedId: string | null; previewIndex: number; onToggleExpand: (id: string) => void; onUpdate: (id: string, patch: Partial<Highlight>) => void; onDelete: (id: string) => void; onPreview: (index: number) => void; onMove: (id: string, direction: -1 | 1) => void; onReorder: (ids: string[], rollback: () => void) => void }) {
  const [ordered, setOrdered] = useState(highlights);
  useEffect(() => setOrdered(highlights), [highlights]);
  const snippets = useHighlightSnippets(code, ordered);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || ordered.length < 2) return;
    const from = ordered.findIndex((h) => h.id === active.id);
    const to = ordered.findIndex((h) => h.id === over.id);
    if (from < 0 || to < 0) return;
    const previous = ordered;
    const next = arrayMove(ordered, from, to);
    setOrdered(next);
    onReorder(next.map((h) => h.id), () => setOrdered(previous));
  }, [ordered, onReorder]);
  if (highlights.length === 0) return null;
  return <div className="border-t border-border/50 bg-muted/20"><div className="flex items-center justify-between px-2 py-1.5"><span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Highlight steps ({highlights.length})</span><span className="text-[9px] text-muted-foreground/70">Plays in order on →</span></div><DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}><SortableContext items={ordered.map((h) => h.id)} strategy={verticalListSortingStrategy}><div className="max-h-[180px] space-y-1 overflow-y-auto px-2 pb-2">{ordered.map((highlight, index) => <SortableHighlightRow key={highlight.id} id={highlight.id} disabled={ordered.length < 2}>{(dragHandle) => <HighlightRow highlight={highlight} index={index} total={ordered.length} snippet={snippets?.[index]} isExpanded={expandedId === highlight.id} isPreviewing={previewIndex === index} dragHandle={dragHandle} onToggleExpand={onToggleExpand} onMove={onMove} onPreview={onPreview} onDelete={onDelete} onUpdate={onUpdate} />}</SortableHighlightRow>)}</div></SortableContext></DndContext></div>;
}
