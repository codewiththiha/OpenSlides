<script lang="ts">
  /** Theme section of the settings drawer (§6.9). */
  import SettingsSection from "$lib/ui/SettingsSection.svelte";
  import ThemeGridPicker from "@/features/settings/ThemeGridPicker.svelte";
  import {
    setPreviewProjectSetting,
    clearPreviewProjectSetting,
  } from "$lib/stores/ui-state.svelte";
  import type { ThemeName } from "$lib/types";

  let {
    currentTheme,
    onCommitTheme,
  }: {
    currentTheme: string;
    onCommitTheme: (theme: ThemeName) => void;
  } = $props();
</script>

<SettingsSection title="Theme" description="Choose a syntax theme from its live code preview.">
  <ThemeGridPicker
    value={currentTheme}
    onPreviewTheme={(theme) => setPreviewProjectSetting("theme", theme)}
    onClearPreviewTheme={() => clearPreviewProjectSetting("theme")}
    onChange={(theme) => {
      clearPreviewProjectSetting("theme");
      onCommitTheme(theme as ThemeName);
    }}
  />
</SettingsSection>
