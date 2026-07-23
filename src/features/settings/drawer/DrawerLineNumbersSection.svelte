<script lang="ts">
  /**
   * Line-numbers + typography section of the settings drawer (§6.9).
   * Preview line numbers (slide view) are separate from editor gutter
   * numbers; font sliders preview instantly and save only on commit.
   */
  import SettingsSection from "$lib/ui/SettingsSection.svelte";
  import SliderField from "$lib/ui/SliderField.svelte";
  import ToggleField from "$lib/ui/ToggleField.svelte";
  import {
    ui,
    setEditorShowLineNumbers,
    setShowSlideHoverPreview,
    setPreviewProjectSetting,
  } from "$lib/stores/ui-state.svelte";
  import { previewProjectSettings } from "@/features/settings/preview-settings";
  import { showUndoToast } from "$lib/lib/settings-undo";
  import type { SettingsPatch } from "$lib/lib/tauri-api";
  import type { ProjectSettings } from "$lib/types";

  let {
    settings,
    onPatch,
  }: {
    settings: ProjectSettings;
    onPatch: (patch: SettingsPatch) => void;
  } = $props();

  const previewProject = $derived(previewProjectSettings());

  const effFontSize = $derived(previewProject.fontSize ?? settings.fontSize);
  const effLineHeight = $derived(
    previewProject.lineHeight ?? settings.lineHeight,
  );
  const effEditorFontSize = $derived(
    previewProject.editorFontSize ?? settings.editorFontSize,
  );
</script>

<SettingsSection title="Line numbers">
  <ToggleField
    label="Slide preview"
    description="Shown during preview / presentation"
    checked={settings.showLineNumbers}
    onChange={(v) => onPatch({ showLineNumbers: v })}
  />
  <ToggleField
    label="Highlight step control"
    description="Show the floating highlight progress control in preview and presentation"
    checked={settings.showHighlightStepIndicator}
    onChange={(v) => onPatch({ showHighlightStepIndicator: v })}
  />
  <ToggleField
    label="Code editor"
    description="Line numbers in the code editor"
    checked={ui.editorShowLineNumbers}
    onChange={(next) => {
      const before = ui.editorShowLineNumbers;
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
    checked={ui.showSlideHoverPreview}
    onChange={setShowSlideHoverPreview}
  />

  <div class="pt-2">
    <SliderField
      label="Preview font size"
      labelClassName="text-xs text-muted-foreground"
      value={effFontSize}
      min={12}
      max={32}
      step={2}
      format={(v) => `${v}px`}
      onPreview={(v) => setPreviewProjectSetting("fontSize", v)}
      onCommit={(v) => onPatch({ fontSize: v })}
    />
  </div>

  <div>
    <SliderField
      label="Line height"
      labelClassName="text-xs text-muted-foreground"
      value={effLineHeight}
      min={1.1}
      max={2.2}
      step={0.05}
      format={(v) => v.toFixed(2)}
      onPreview={(v) => setPreviewProjectSetting("lineHeight", v)}
      onCommit={(v) => onPatch({ lineHeight: v })}
    />
  </div>

  <div>
    <SliderField
      label="Editor font size"
      labelClassName="text-xs text-muted-foreground"
      value={effEditorFontSize}
      min={11}
      max={22}
      step={1}
      format={(v) => `${v}px`}
      onPreview={(v) => setPreviewProjectSetting("editorFontSize", v)}
      onCommit={(v) => onPatch({ editorFontSize: v })}
    />
  </div>
</SettingsSection>
