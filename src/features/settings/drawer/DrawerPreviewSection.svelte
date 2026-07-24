<script lang="ts">
  /** Slide preview presentation controls. */
  import SettingsSection from "$lib/ui/SettingsSection.svelte";
  import SliderField from "$lib/ui/SliderField.svelte";
  import ToggleField from "$lib/ui/ToggleField.svelte";
  import { setPreviewProjectSetting } from "$lib/stores/ui-state.svelte";
  import type { SettingsPatch } from "$lib/lib/tauri-api";
  import type { ProjectSettings } from "$lib/types";

  let {
    settings,
    effFontSize,
    effLineHeight,
    onPatch,
  }: {
    settings: ProjectSettings;
    effFontSize: number;
    effLineHeight: number;
    onPatch: (patch: SettingsPatch) => void;
  } = $props();
</script>

<SettingsSection title="Preview">
  <ToggleField
    label="Slide line numbers"
    checked={settings.showLineNumbers}
    onChange={(v) => onPatch({ showLineNumbers: v })}
  />
  <ToggleField
    label="Highlight step indicator"
    checked={settings.showHighlightStepIndicator}
    onChange={(v) => onPatch({ showHighlightStepIndicator: v })}
  />

  <div class="space-y-4 pt-1">
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
</SettingsSection>
