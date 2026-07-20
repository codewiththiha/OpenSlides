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
import { THEME_OPTIONS, type Project, type ThemeName } from "@/types";
import { useUpdateSettings, useUpdateTheme } from "@/hooks/queries";
import { useUiStore } from "@/store/useUiStore";
import { cn } from "@/lib/utils";
import { showUndoToast } from "@/lib/settings-undo";
import { Z_INDEX } from "./ui/overlay";
import { SliderField } from "./ui/slider-field";
import { ToggleField } from "./ui/toggle-field";

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
            <ToggleField
              label="Slide preview"
              description="Shown during preview / presentation"
              checked={s.showLineNumbers}
              onChange={(v) => patch({ showLineNumbers: v })}
            />
            <ToggleField
              label="Code editor"
              description="Gutter in the editor only"
              checked={editorShowLineNumbers}
              onChange={(next) => {
                const before = editorShowLineNumbers;
                setEditorShowLineNumbers(next);
                showUndoToast(
                  "undo-editor-showLineNumbers",
                  next ? "Editor line numbers on" : "Editor line numbers off",
                  () => setEditorShowLineNumbers(before),
                );
              }}
            />
            <ToggleField
              label="Slide hover previews"
              description="Show enlarged thumbnails when hovering slide cards"
              checked={showSlideHoverPreview}
              onChange={setShowSlideHoverPreview}
            />

            <div className="pt-2">
              <SliderField
                label="Preview font size"
                labelClassName="text-xs text-muted-foreground"
                value={effFontSize}
                min={12} max={32} step={2}
                format={(v) => `${v}px`}
                onPreview={(v) => setPreviewProjectSetting("fontSize", v)}
                onCommit={(v) => patch({ fontSize: v })}
              />
            </div>

            <div>
              <SliderField
                label="Line height"
                labelClassName="text-xs text-muted-foreground"
                value={effLineHeight}
                min={1.1} max={2.2} step={0.05}
                format={(v) => v.toFixed(2)}
                onPreview={(v) => setPreviewProjectSetting("lineHeight", v)}
                onCommit={(v) => patch({ lineHeight: v })}
              />
            </div>

            <div>
              <SliderField
                label="Editor font size"
                labelClassName="text-xs text-muted-foreground"
                value={effEditorFontSize}
                min={11} max={22} step={1}
                format={(v) => `${v}px`}
                onPreview={(v) => setPreviewProjectSetting("editorFontSize", v)}
                onCommit={(v) => patch({ editorFontSize: v })}
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

            <ToggleField label="Use global transition" checked={s.useGlobalTransition} onChange={(v) => patch({ useGlobalTransition: v })} />
            {s.useGlobalTransition && (
              <div>
                <SliderField
                  label="Transition"
                  labelClassName="text-xs text-muted-foreground"
                  value={effGlobalTransition}
                  min={100} max={2000} step={50}
                  format={(v) => `${v}ms`}
                  onPreview={(v) => setPreviewProjectSetting("globalTransitionDuration", v)}
                  onCommit={(v) => patch({ globalTransitionDuration: v })}
                />
              </div>
            )}

            <ToggleField label="Use global stagger" checked={s.useGlobalStagger} onChange={(v) => patch({ useGlobalStagger: v })} />
            {s.useGlobalStagger && (
              <div>
                <SliderField
                  label="Stagger"
                  labelClassName="text-xs text-muted-foreground"
                  value={effGlobalStagger}
                  min={0} max={50} step={1}
                  onPreview={(v) => setPreviewProjectSetting("globalStagger", v)}
                  onCommit={(v) => patch({ globalStagger: v })}
                />
              </div>
            )}
          </section>
        </div>
      </aside>
    </>
  );
}
