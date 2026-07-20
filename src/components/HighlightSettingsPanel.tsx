/**
 * Panel showing the ordered highlight steps for the current slide.
 *
 * Each row: step number, the selected code snippet, line/char range,
 * preview toggle (mirrors the step into the slide preview), per-highlight
 * settings (dim / size-up / custom animation timings), reorder and delete.
 *
 * Order here IS the playback order when stepping with → / clicks.
 * Fix: sliders now update Zustand previewHighlights instantly for live preview,
 * while DB save happens on commit. Preview cleared via parent onSuccess to avoid flicker.
 */
import {
  Trash2,
  ChevronDown,
  ChevronUp,
  Eye,
  ArrowUp,
  ArrowDown,
  GripVertical,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { DebouncedSlider } from "./ui/debounced-slider";
import { Switch } from "./ui/switch";
import { cn } from "@/lib/utils";
import { useHighlightSnippets } from "@/hooks/queries/highlights";
import { useUiStore } from "@/store/useUiStore";
import type { Highlight } from "@/types";

interface HighlightSettingsPanelProps {
  highlights: Highlight[];
  /** Current slide code — used to show the snippet on each row. */
  code: string;
  expandedId: string | null;
  /** Index currently mirrored into the slide preview (-1 = none). */
  previewIndex: number;
  onToggleExpand: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Highlight>) => void;
  onDelete: (id: string) => void;
  onPreview: (index: number) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onReorder: (ids: string[], rollback: () => void) => void;
}

function SortableHighlightRow({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled: boolean;
  children: (handle: React.ReactNode) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id,
    disabled,
  });
  const handle = (
    <button
      type="button"
      className="shrink-0 cursor-grab touch-none rounded text-muted-foreground hover:bg-muted active:cursor-grabbing"
      disabled={disabled}
      {...attributes}
      {...listeners}
      aria-label="Drag to reorder highlight"
      onClick={(e) => e.stopPropagation()}
    >
      <GripVertical className="h-3 w-3" />
    </button>
  );
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
      }}
    >
      {children(handle)}
    </div>
  );
}

export function HighlightSettingsPanel({
  highlights,
  code,
  expandedId,
  previewIndex,
  onToggleExpand,
  onUpdate,
  onDelete,
  onPreview,
  onMove,
  onReorder,
}: HighlightSettingsPanelProps) {
  const [ordered, setOrdered] = useState(highlights);
  useEffect(() => setOrdered(highlights), [highlights]);
  const snippets = useHighlightSnippets(code, ordered);
  const previewHighlights = useUiStore((s) => s.previewHighlights);
  const setPreviewHighlightSetting = useUiStore((s) => s.setPreviewHighlightSetting);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || ordered.length < 2) return;
    const oldIndex = ordered.findIndex((hl) => hl.id === active.id);
    const newIndex = ordered.findIndex((hl) => hl.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const previous = ordered;
    const next = arrayMove(ordered, oldIndex, newIndex);
    setOrdered(next);
    onReorder(next.map((hl) => hl.id), () => setOrdered(previous));
  };

  if (highlights.length === 0) return null;

  return (
    <div className="border-t border-border/50 bg-muted/20">
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Highlight steps ({highlights.length})
        </span>
        <span className="text-[9px] text-muted-foreground/70">
          Plays in order on →
        </span>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ordered.map((hl) => hl.id)} strategy={verticalListSortingStrategy}>
          <div className="max-h-[180px] overflow-y-auto px-2 pb-2 space-y-1">
            {ordered.map((hl, index) => {
              const isExpanded = expandedId === hl.id;
          const isPreviewing = previewIndex === index;
          const rawSnippet = snippets?.[index];
          const snippet =
            rawSnippet === undefined
              ? "…"
              : rawSnippet.replace(/\s+/g, " ").trim() || "(empty selection)";

          const preview = previewHighlights[hl.id];
          const eff = preview ? { ...hl, ...preview } : hl;

              return (
                <SortableHighlightRow key={hl.id} id={hl.id} disabled={ordered.length < 2}>
                  {(dragHandle) => (
                    <div
                      className={cn(
                "rounded-md border transition-colors",
                isPreviewing
                  ? "border-primary/60 bg-primary/10"
                  : isExpanded
                    ? "border-primary/40 bg-card/80"
                    : "border-border/40 bg-card/40 hover:bg-card/60",
              )}
            >
              <div className="flex items-center gap-1 px-2 py-1">
                {dragHandle}
                <button
                  type="button"
                  className="flex-1 flex items-center gap-1.5 text-left min-w-0"
                  onClick={() => onToggleExpand(hl.id)}
                  title={`L${hl.startLine + 1}:${hl.startChar} → L${hl.endLine + 1}:${hl.endChar}`}
                >
                  <span className="shrink-0 text-[10px] font-mono text-primary/80">
                    #{index + 1}
                  </span>
                  <span className="truncate font-mono text-[10px] text-foreground/80">
                    {snippet}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0"
                  disabled={index === 0}
                  onClick={() => onMove(hl.id, -1)}
                  title="Move earlier in playback order"
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0"
                  disabled={index === highlights.length - 1}
                  onClick={() => onMove(hl.id, 1)}
                  title="Move later in playback order"
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-5 w-5 shrink-0",
                    isPreviewing && "bg-primary/20 text-primary",
                  )}
                  onClick={() => onPreview(index)}
                  title={
                    isPreviewing
                      ? "Stop previewing this step"
                      : "Preview this step in the slide"
                  }
                >
                  <Eye className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0"
                  onClick={() => onToggleExpand(hl.id)}
                >
                  {isExpanded ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0 hover:text-destructive"
                  onClick={() => onDelete(hl.id)}
                  title="Delete highlight"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    className="px-2 pb-2 space-y-2"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="space-y-1">
                      <Label className="text-[9px] text-muted-foreground">
                        Dim ({eff.dimAmount}%)
                      </Label>
                      <DebouncedSlider
                        min={0}
                        max={100}
                        step={5}
                        value={[eff.dimAmount]}
                        onValueChange={([v]) =>
                          setPreviewHighlightSetting(hl.id, { dimAmount: v })
                        }
                        onValueCommit={([v]) => onUpdate(hl.id, { dimAmount: v })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label className="text-[9px] text-muted-foreground">
                        Size Up
                      </Label>
                      <Switch
                        checked={eff.sizeUpEnabled}
                        onCheckedChange={(v) =>
                          onUpdate(hl.id, { sizeUpEnabled: v })
                        }
                      />
                    </div>

                    {eff.sizeUpEnabled && (
                      <div className="space-y-1">
                        <Label className="text-[9px] text-muted-foreground">
                          Size Up Amount ({eff.sizeUpAmount ?? 125}%)
                        </Label>
                        <DebouncedSlider
                          min={105}
                          max={250}
                          step={5}
                          value={[eff.sizeUpAmount ?? 125]}
                          onValueChange={([v]) =>
                            setPreviewHighlightSetting(hl.id, { sizeUpAmount: v })
                          }
                          onValueCommit={([v]) =>
                            onUpdate(hl.id, { sizeUpAmount: v })
                          }
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <Label className="text-[9px] text-muted-foreground">
                        Custom Animations
                      </Label>
                      <Switch
                        checked={eff.useCustomTransition}
                        onCheckedChange={(v) =>
                          onUpdate(hl.id, { useCustomTransition: v })
                        }
                      />
                    </div>

                    {eff.useCustomTransition && (
                      <>
                        <div className="space-y-1">
                          <Label className="text-[9px] text-muted-foreground">
                            Dim Transition ({eff.dimTransition}ms)
                          </Label>
                          <DebouncedSlider
                            min={100}
                            max={2000}
                            step={50}
                            value={[eff.dimTransition]}
                            onValueChange={([v]) =>
                              setPreviewHighlightSetting(hl.id, { dimTransition: v })
                            }
                            onValueCommit={([v]) =>
                              onUpdate(hl.id, { dimTransition: v })
                            }
                          />
                        </div>
                        {eff.sizeUpEnabled && (
                          <div className="space-y-1">
                            <Label className="text-[9px] text-muted-foreground">
                              Size Up Transition ({eff.sizeUpTransition}ms)
                            </Label>
                            <DebouncedSlider
                              min={100}
                              max={2000}
                              step={50}
                              value={[eff.sizeUpTransition]}
                              onValueChange={([v]) =>
                                setPreviewHighlightSetting(hl.id, {
                                  sizeUpTransition: v,
                                })
                              }
                              onValueCommit={([v]) =>
                                onUpdate(hl.id, { sizeUpTransition: v })
                              }
                            />
                          </div>
                        )}
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
                    </div>
                  )}
                </SortableHighlightRow>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
