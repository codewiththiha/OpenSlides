/**
 * Right-side settings drawer for global project options.
 * Preview line numbers (slide view) are separate from editor gutter numbers.
 * Fix: fontSize / lineHeight / editorFontSize / global durations now update
 * preview instantly via Zustand previewProject overrides, while DB save
 * happens only on commit.
 */
import { X } from "lucide-react";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { DebouncedSlider } from "./ui/debounced-slider";
import { THEME_OPTIONS, type Project, type ThemeName } from "@/types";
import { useUpdateSettings, useUpdateTheme } from "@/hooks/queries";
import { useUiStore } from "@/store/useUiStore";
import { cn } from "@/lib/utils";
import { showUndoToast } from "@/lib/settings-undo";
import { Z_INDEX } from "./ui/overlay";

interface SettingsDrawerProps {
  project: Project;
  open: boolean;
  onClose: () => void;
}

export function SettingsDrawer({ project, open, onClose }: SettingsDrawerProps) {
  const updateSettings = useUpdateSettings(project.id);
  const updateTheme = useUpdateTheme(project.id);
  const editorShowLineNumbers = useUiStore((s) => s.editorShowLineNumbers);
  const showSlideHoverPreview = useUiStore((s) => s.showSlideHoverPreview);
  const setShowSlideHoverPreview = useUiStore((s) => s.setShowSlideHoverPreview);
  const setEditorShowLineNumbers = useUiStore(
    (s) => s.setEditorShowLineNumbers,
  );

  const previewProject = useUiStore((s) => s.previewProject);
  const setPreviewProjectSetting = useUiStore((s) => s.setPreviewProjectSetting);
  const clearPreviewProjectSetting = useUiStore((s) => s.clearPreviewProjectSetting);

  const s = project.settings;

  // effective values (preview wins)
  const effFontSize = previewProject.fontSize ?? s.fontSize;
  const effLineHeight = previewProject.lineHeight ?? s.lineHeight;
  const effEditorFontSize = previewProject.editorFontSize ?? s.editorFontSize;
  const effGlobalTransition =
    previewProject.globalTransitionDuration ?? s.globalTransitionDuration;
  const effGlobalStagger = previewProject.globalStagger ?? s.globalStagger;

  const patch = (partial: Parameters<typeof updateSettings.mutate>[0]) => {
    updateSettings.mutate(partial, {
      onSuccess: () => {
        // Sync preview back to DB state after successful save:
        // clear the preview override for the keys we just saved.
        for (const k of Object.keys(partial)) {
          if (
            k === "fontSize" ||
            k === "lineHeight" ||
            k === "editorFontSize" ||
            k === "globalTransitionDuration" ||
            k === "globalStagger" ||
            k === "codeAlign" ||
            k === "showLineNumbers" ||
            k === "useGlobalTransition" ||
            k === "useGlobalStagger"
          ) {
            clearPreviewProjectSetting(
              k as keyof typeof previewProject,
            );
          }
        }
      },
    });
  };

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 bg-black/40 transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        style={{ zIndex: Z_INDEX.drawerBackdrop }}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed right-0 top-0 flex h-full w-[340px] flex-col border-l bg-card shadow-2xl transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full",
        )}
        style={{ zIndex: Z_INDEX.drawer }}
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
              onChange={(e) => updateTheme.mutate(e.target.value as ThemeName)}
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
                onCheckedChange={(next) => {
                  const before = editorShowLineNumbers;
                  setEditorShowLineNumbers(next);
                  showUndoToast(
                    "undo-editor-showLineNumbers",
                    next ? "Editor line numbers on" : "Editor line numbers off",
                    () => setEditorShowLineNumbers(before),
                  );
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Slide hover previews</Label>
                <p className="text-[11px] text-muted-foreground">
                  Show enlarged thumbnails when hovering slide cards
                </p>
              </div>
              <Switch
                checked={showSlideHoverPreview}
                onCheckedChange={setShowSlideHoverPreview}
              />
            </div>

            <div className="space-y-1.5 pt-2">
              <Label className="text-xs text-muted-foreground">
                Preview font size ({effFontSize}px)
              </Label>
              <DebouncedSlider
                min={12}
                max={32}
                step={2}
                value={[effFontSize]}
                onValueChange={([v]) => setPreviewProjectSetting("fontSize", v)}
                onValueCommit={([v]) => patch({ fontSize: v })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Line height ({effLineHeight.toFixed(2)})
              </Label>
              <DebouncedSlider
                min={1.1}
                max={2.2}
                step={0.05}
                value={[effLineHeight]}
                onValueChange={([v]) => setPreviewProjectSetting("lineHeight", v)}
                onValueCommit={([v]) => patch({ lineHeight: v })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Editor font size ({effEditorFontSize}px)
              </Label>
              <DebouncedSlider
                min={11}
                max={22}
                step={1}
                value={[effEditorFontSize]}
                onValueChange={([v]) =>
                  setPreviewProjectSetting("editorFontSize", v)
                }
                onValueCommit={([v]) => patch({ editorFontSize: v })}
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
                  Transition ({effGlobalTransition}ms)
                </Label>
                <DebouncedSlider
                  min={100}
                  max={2000}
                  step={50}
                  value={[effGlobalTransition]}
                  onValueChange={([v]) =>
                    setPreviewProjectSetting("globalTransitionDuration", v)
                  }
                  onValueCommit={([v]) => patch({ globalTransitionDuration: v })}
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
                  Stagger ({effGlobalStagger})
                </Label>
                <DebouncedSlider
                  min={0}
                  max={50}
                  step={1}
                  value={[effGlobalStagger]}
                  onValueChange={([v]) =>
                    setPreviewProjectSetting("globalStagger", v)
                  }
                  onValueCommit={([v]) => patch({ globalStagger: v })}
                />
              </div>
            )}
          </section>
        </div>
      </aside>
    </>
  );
}
