/**
 * Panel that shows existing highlights for the current slide.
 * Allows editing dim amount, size-up toggle, custom transitions, and deletion.
 * Appears in the CodeEditor when highlights exist.
 */
import { Trash2, ChevronDown, ChevronUp, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";
import { Switch } from "./ui/switch";
import { cn } from "@/lib/utils";
import type { Highlight } from "@/types";

interface HighlightSettingsPanelProps {
  highlights: Highlight[];
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Highlight>) => void;
  onDelete: (id: string) => void;
  onPreview: (index: number) => void;
}

export function HighlightSettingsPanel({
  highlights,
  expandedId,
  onToggleExpand,
  onUpdate,
  onDelete,
  onPreview,
}: HighlightSettingsPanelProps) {
  if (highlights.length === 0) return null;

  return (
    <div className="border-t border-border/50 bg-muted/20">
      <div className="px-2 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Highlights ({highlights.length})
        </span>
      </div>
      <div className="max-h-[180px] overflow-y-auto px-2 pb-2 space-y-1">
        {highlights.map((hl, index) => {
          const isExpanded = expandedId === hl.id;
          return (
            <div
              key={hl.id}
              className={cn(
                "rounded-md border transition-colors",
                isExpanded
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
                >
                  <span className="shrink-0 text-[10px] font-mono text-primary/80">
                    #{index + 1}
                  </span>
                  <span className="truncate text-[10px] text-muted-foreground">
                    L{hl.startLine + 1}:{hl.startChar} → L{hl.endLine + 1}:
                    {hl.endChar}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0"
                  onClick={() => onPreview(index)}
                  title="Preview this highlight"
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
                      <Slider
                        min={0}
                        max={100}
                        step={5}
                        value={[hl.dimAmount]}
                        onValueChange={([v]) =>
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
                          <Slider
                            min={100}
                            max={2000}
                            step={50}
                            value={[hl.dimTransition]}
                            onValueChange={([v]) =>
                              onUpdate(hl.id, { dimTransition: v })
                            }
                          />
                        </div>
                        {hl.sizeUpEnabled && (
                          <div className="space-y-1">
                            <Label className="text-[9px] text-muted-foreground">
                              Size Up Transition ({hl.sizeUpTransition}ms)
                            </Label>
                            <Slider
                              min={100}
                              max={2000}
                              step={50}
                              value={[hl.sizeUpTransition]}
                              onValueChange={([v]) =>
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
