/**
 * Panel showing the ordered highlight steps for the current slide.
 *
 * Each row: step number, the selected code snippet, line/char range,
 * preview toggle (mirrors the step into the slide preview), per-highlight
 * settings (dim / size-up / custom animation timings), reorder and delete.
 *
 * Order here IS the playback order when stepping with → / clicks.
 */
import {
  Trash2,
  ChevronDown,
  ChevronUp,
  Eye,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { DebouncedSlider } from "./ui/debounced-slider";
import { Switch } from "./ui/switch";
import { cn } from "@/lib/utils";
import { useHighlightSnippets } from "@/hooks/queries/highlights";
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
}: HighlightSettingsPanelProps) {
  // Snippets are sliced in Rust (same parsing the overlay plans use).
  const { data: snippets } = useHighlightSnippets(code, highlights);

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
      <div className="max-h-[180px] overflow-y-auto px-2 pb-2 space-y-1">
        {highlights.map((hl, index) => {
          const isExpanded = expandedId === hl.id;
          const isPreviewing = previewIndex === index;
          const rawSnippet = snippets?.[index];
          const snippet =
            rawSnippet === undefined
              ? "…"
              : rawSnippet.replace(/\s+/g, " ").trim() || "(empty selection)";
          return (
            <div
              key={hl.id}
              className={cn(
                "rounded-md border transition-colors",
                isPreviewing
                  ? "border-primary/60 bg-primary/10"
                  : isExpanded
                    ? "border-primary/40 bg-card/80"
                    : "border-border/40 bg-card/40 hover:bg-card/60",
              )}
            >
              {/* Header row */}
              <div className="flex items-center gap-1 px-2 py-1">
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

              {/* Expanded settings */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    className="px-2 pb-2 space-y-2"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {/* Dim amount */}
                    <div className="space-y-1">
                      <Label className="text-[9px] text-muted-foreground">
                        Dim ({hl.dimAmount}%)
                      </Label>
                      <DebouncedSlider
                        min={0}
                        max={100}
                        step={5}
                        value={[hl.dimAmount]}
                        onValueCommit={([v]) =>
                          onUpdate(hl.id, { dimAmount: v })
                        }
                      />
                    </div>

                    {/* Size up toggle */}
                    <div className="flex items-center justify-between">
                      <Label className="text-[9px] text-muted-foreground">
                        Size Up
                      </Label>
                      <Switch
                        checked={hl.sizeUpEnabled}
                        onCheckedChange={(v) =>
                          onUpdate(hl.id, { sizeUpEnabled: v })
                        }
                      />
                    </div>

                    {/* Size up amount (only when size-up is on) */}
                    {hl.sizeUpEnabled && (
                      <div className="space-y-1">
                        <Label className="text-[9px] text-muted-foreground">
                          Size Up Amount ({hl.sizeUpAmount ?? 125}%)
                        </Label>
                        <DebouncedSlider
                          min={105}
                          max={250}
                          step={5}
                          value={[hl.sizeUpAmount ?? 125]}
                          onValueCommit={([v]) =>
                            onUpdate(hl.id, { sizeUpAmount: v })
                          }
                        />
                      </div>
                    )}

                    {/* Custom transition toggle */}
                    <div className="flex items-center justify-between">
                      <Label className="text-[9px] text-muted-foreground">
                        Custom Animations
                      </Label>
                      <Switch
                        checked={hl.useCustomTransition}
                        onCheckedChange={(v) =>
                          onUpdate(hl.id, { useCustomTransition: v })
                        }
                      />
                    </div>

                    {/* Transition sliders (only when custom is on) */}
                    {hl.useCustomTransition && (
                      <>
                        <div className="space-y-1">
                          <Label className="text-[9px] text-muted-foreground">
                            Dim Transition ({hl.dimTransition}ms)
                          </Label>
                          <DebouncedSlider
                            min={100}
                            max={2000}
                            step={50}
                            value={[hl.dimTransition]}
                            onValueCommit={([v]) =>
                              onUpdate(hl.id, { dimTransition: v })
                            }
                          />
                        </div>
                        {hl.sizeUpEnabled && (
                          <div className="space-y-1">
                            <Label className="text-[9px] text-muted-foreground">
                              Size Up Transition ({hl.sizeUpTransition}ms)
                            </Label>
                            <DebouncedSlider
                              min={100}
                              max={2000}
                              step={50}
                              value={[hl.sizeUpTransition]}
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
          );
        })}
      </div>
    </div>
  );
}
