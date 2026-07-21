/**
 * Right-side settings drawer for global project options.
 * Preview line numbers (slide view) are separate from editor gutter numbers.
 * Fix: fontSize / lineHeight / editorFontSize / global durations now update
 * preview instantly via Zustand previewProject overrides, while DB save
 * happens only on commit.
 */
import { X } from "lucide-react";
import { Button } from "./ui/button";
import { THEME_OPTIONS, type Project, type ThemeName } from "@/types";
import { useUpdateSettings, useUpdateTheme } from "@/hooks/queries";
import { useUiStore } from "@/store/useUiStore";
import { cn } from "@/lib/utils";
import { showUndoToast } from "@/lib/settings-undo";
import { Z_INDEX } from "./ui/overlay";
import { SelectField } from "./ui/select-field";
import { SettingsSection } from "./ui/settings-section";
import { SliderField } from "./ui/slider-field";
import { ToggleField } from "./ui/toggle-field";
import { CodeAlignPicker } from "./settings/CodeAlignPicker";
import { GlobalAnimationSection } from "./settings/GlobalAnimationSection";

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
          <h2 className="text-sm font-semibold">Presentation Settings</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          <SettingsSection title="Theme">
            <SelectField
              selectSize="md"
              options={THEME_OPTIONS}
              value={project.theme}
              onChange={(e) => updateTheme.mutate(e.target.value as ThemeName)}
            />
          </SettingsSection>

          <SettingsSection
            title="Code layout"
            description="Where the code block sits on your slides. Applies to all slides."
          >
            <CodeAlignPicker
              value={s.codeAlign ?? "left"}
              onChange={(align) => patch({ codeAlign: align })}
            />
          </SettingsSection>

          <SettingsSection title="Line numbers">
            <ToggleField
              label="Slide preview"
              description="Shown during preview / presentation"
              checked={s.showLineNumbers}
              onChange={(v) => patch({ showLineNumbers: v })}
            />
            <ToggleField
              label="Code editor"
              description="Line numbers in the code editor"
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
              description="Show a larger preview when you hover over a slide"
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
          </SettingsSection>

          <SettingsSection
            title="Global Animations"
            description="When on, every slide uses these animation values and the per-slide sliders are locked."
            borderTop
          >
            <p className="text-[11px] text-muted-foreground">
              Stagger is the delay between each animated character.
            </p>
            <GlobalAnimationSection
              settings={s}
              effTransition={effGlobalTransition}
              effStagger={effGlobalStagger}
              onPreview={setPreviewProjectSetting}
              onCommit={patch}
            />
          </SettingsSection>
        </div>
      </aside>
    </>
  );
}
