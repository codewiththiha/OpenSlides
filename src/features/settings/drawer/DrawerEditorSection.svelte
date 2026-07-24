<script lang="ts">
  /** Editor-only display controls. */
  import SettingsSection from "$lib/ui/SettingsSection.svelte";
  import SliderField from "$lib/ui/SliderField.svelte";
  import ToggleField from "$lib/ui/ToggleField.svelte";
  import {
    ui,
    setEditorShowLineNumbers,
    setShowSlideHoverPreview,
    setPreviewProjectSetting,
  } from "$lib/stores/ui-state.svelte";
  import { showUndoToast } from "$lib/lib/settings-undo";
  import type { SettingsPatch } from "$lib/lib/tauri-api";

  let {
    effEditorFontSize,
    onPatch,
  }: {
    effEditorFontSize: number;
    onPatch: (patch: SettingsPatch) => void;
  } = $props();
</script>

<SettingsSection title="Editor">
  <ToggleField
    label="Editor line numbers"
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
  <ToggleField
    label="Slide hover previews"
    checked={ui.showSlideHoverPreview}
    onChange={setShowSlideHoverPreview}
  />
</SettingsSection>
