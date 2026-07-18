/**
 * Right-side settings drawer for global project options.
 * Preview line numbers (slide view) are separate from editor gutter numbers.
 */
import { X } from "lucide-react";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Slider } from "./ui/slider";
import { THEME_OPTIONS, type Project } from "@/types";
import { useUpdateSettings, useUpdateTheme } from "@/hooks/queries";
import { useUiStore } from "@/store/useUiStore";
import { cn } from "@/lib/utils";

interface SettingsDrawerProps {
  project: Project;
  open: boolean;
  onClose: () => void;
}

export function SettingsDrawer({ project, open, onClose }: SettingsDrawerProps) {
  const updateSettings = useUpdateSettings(project.id);
  const updateTheme = useUpdateTheme(project.id);
  const { editorShowLineNumbers, setEditorShowLineNumbers } = useUiStore();
  const s = project.settings;
  // editorShowLineNumbers stays settings-only (no toolbar toggle)

  const patch = (partial: Parameters<typeof updateSettings.mutate>[0]) => {
    updateSettings.mutate(partial);
  };

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-[340px] flex-col border-l bg-card shadow-2xl transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex h-12 items-center justify-between border-b px-4">
          <h2 className="text-sm font-semibold">Project Settings</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          <section className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Theme
            </Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={project.theme}
              onChange={(e) => updateTheme.mutate(e.target.value)}
            >
              {THEME_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </section>

          <section className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Code layout
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Positions the whole code block on the stage (not per-line text
              alignment). Applies to every slide.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(["left", "center"] as const).map((align) => {
                const active = (s.codeAlign ?? "left") === align;
                return (
                  <button
                    key={align}
                    type="button"
                    onClick={() => patch({ codeAlign: align })}
                    className={cn(
                      "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background hover:bg-muted/50",
                    )}
                  >
                    <div className="font-medium capitalize">{align}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {align === "left"
                        ? "Block starts at the left edge"
                        : "Block centered like CodeSlides"}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Line numbers
            </h3>
            <div className="flex items-center justify-between">
              <div>
                <Label>Slide preview</Label>
                <p className="text-[11px] text-muted-foreground">
                  Shown during preview / presentation
                </p>
              </div>
              <Switch
                checked={s.showLineNumbers}
                onCheckedChange={(v) => patch({ showLineNumbers: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Code editor</Label>
                <p className="text-[11px] text-muted-foreground">
                  Gutter in the editor only
                </p>
              </div>
              <Switch
                checked={editorShowLineNumbers}
                onCheckedChange={setEditorShowLineNumbers}
              />
            </div>

            <div className="space-y-1.5 pt-2">
              <Label className="text-xs text-muted-foreground">
                Preview font size ({s.fontSize}px)
              </Label>
              <Slider
                min={12}
                max={32}
                step={2}
                value={[s.fontSize]}
                onValueChange={([v]) => patch({ fontSize: v })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Line height ({s.lineHeight.toFixed(2)})
              </Label>
              <Slider
                min={1.1}
                max={2.2}
                step={0.05}
                value={[s.lineHeight]}
                onValueChange={([v]) => patch({ lineHeight: v })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Editor font size ({s.editorFontSize}px)
              </Label>
              <Slider
                min={11}
                max={22}
                step={1}
                value={[s.editorFontSize]}
                onValueChange={([v]) => patch({ editorFontSize: v })}
              />
            </div>
          </section>

          <section className="space-y-3 border-t pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Global Animations
            </h3>
            <p className="text-[11px] text-muted-foreground">
              When enabled, per-slide transition / stagger sliders in the editor
              are locked to these values.
            </p>

            <div className="flex items-center justify-between">
              <Label>Use global transition</Label>
              <Switch
                checked={s.useGlobalTransition}
                onCheckedChange={(v) => patch({ useGlobalTransition: v })}
              />
            </div>
            {s.useGlobalTransition && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Transition ({s.globalTransitionDuration}ms)
                </Label>
                <Slider
                  min={100}
                  max={2000}
                  step={50}
                  value={[s.globalTransitionDuration]}
                  onValueChange={([v]) => patch({ globalTransitionDuration: v })}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label>Use global stagger</Label>
              <Switch
                checked={s.useGlobalStagger}
                onCheckedChange={(v) => patch({ useGlobalStagger: v })}
              />
            </div>
            {s.useGlobalStagger && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Stagger ({s.globalStagger})
                </Label>
                <Slider
                  min={0}
                  max={50}
                  step={1}
                  value={[s.globalStagger]}
                  onValueChange={([v]) => patch({ globalStagger: v })}
                />
              </div>
            )}
          </section>
        </div>
      </aside>
    </>
  );
}
