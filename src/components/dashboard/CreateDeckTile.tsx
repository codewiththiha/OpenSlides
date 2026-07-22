import { useEffect, useRef } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { CodeThumbnail } from "../ui/code-thumbnail";
import { useShikiDisplayHtml } from "@/hooks/useShikiDisplayState";
import { THEMES } from "@/lib/themes";
import { cn } from "@/lib/utils";
import { NEW_PRESENTATION_CODE } from "@/constants";

export const DEFAULT_WELCOME = NEW_PRESENTATION_CODE;

export interface CreateDeckTileProps {
  isExpanded: boolean;
  onToggleExpand: (expanded: boolean) => void;
  name: string;
  onNameChange: (name: string) => void;
  selectedTheme: string;
  onThemeChange: (theme: string) => void;
  onCreate: () => void;
  isPending: boolean;
  className?: string;
  isStandalone?: boolean;
}

export function CreateDeckTile({
  isExpanded,
  onToggleExpand,
  name,
  onNameChange,
  selectedTheme,
  onThemeChange,
  onCreate,
  isPending,
  className,
  isStandalone = false,
}: CreateDeckTileProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const { html } = useShikiDisplayHtml({
    code: DEFAULT_WELCOME,
    language: "typescript",
    theme: selectedTheme || "dark-plus",
    resetKey: "create-deck-preview",
    debounceMs: 80,
    policyName: "previewTile",
  });

  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  if (!isExpanded) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onToggleExpand(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleExpand(true);
          }
        }}
        className={cn(
          "group flex h-full min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card/40 p-6 text-center transition-all duration-200 hover:border-primary/60 hover:bg-card/80 hover:shadow-md",
          className
        )}
        aria-label="Create new presentation"
      >
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-110">
          <Plus className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">New Presentation</h3>
        <p className="mt-1 text-xs text-muted-foreground">Click or press Enter to start</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-primary/40 bg-card p-5 shadow-lg transition-all duration-300 animate-in fade-in-0 zoom-in-95",
        isStandalone ? "mb-8" : "mb-6",
        className
      )}
    >
      <div className="mb-4 flex items-center justify-between border-b border-border/40 pb-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Create New Presentation</h3>
          <p className="text-xs text-muted-foreground">Configure your deck theme and starting slide preview</p>
        </div>
        {!isStandalone && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => onToggleExpand(false)}
            aria-label="Collapse create tile"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Form Controls */}
        <div className="flex flex-col justify-between gap-5 lg:col-span-5">
          <div className="space-y-4">
            <div>
              <label htmlFor="create-deck-name" className="mb-1.5 block text-xs font-medium text-foreground">
                Presentation Name
              </label>
              <Input
                id="create-deck-name"
                ref={inputRef}
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onCreate();
                  if (e.key === "Escape" && !isStandalone) onToggleExpand(false);
                }}
                placeholder="Untitled Presentation"
                className="w-full"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                Theme Color Palette ({THEMES.find((t) => t.value === (selectedTheme || "dark-plus"))?.label || "Dark+"})
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                {THEMES.map((t) => {
                  const isSelected = (selectedTheme || "dark-plus") === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => onThemeChange(t.value)}
                      title={t.label}
                      className={cn(
                        "h-5 w-5 rounded-full border border-border/80 transition-all duration-150 hover:scale-125 focus:outline-none",
                        isSelected
                          ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110"
                          : "opacity-80 hover:opacity-100"
                      )}
                      style={{ backgroundColor: t.background }}
                      aria-label={`Select theme ${t.label}`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button onClick={onCreate} disabled={isPending} className="gap-2">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Presentation
            </Button>
            {!isStandalone && (
              <Button variant="ghost" onClick={() => onToggleExpand(false)}>
                Cancel
              </Button>
            )}
          </div>
        </div>

        {/* Right Column: Live Shiki Preview */}
        <div className="flex flex-col lg:col-span-7">
          <label className="mb-1.5 block text-xs font-medium text-foreground">
            Live Starting Slide Preview
          </label>
          <div className="relative flex-1 rounded-lg border border-border/60 bg-background/50 p-1">
            <CodeThumbnail
              html={html}
              theme={selectedTheme || "dark-plus"}
              fontSize={7.5}
              lineHeight={1.4}
              className="h-44 w-full rounded-md border border-border/40 p-3 shadow-inner"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
