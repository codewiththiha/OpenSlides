<script lang="ts">
  /** Theme section of the settings drawer (§6.9). */
  import SettingsSection from "$lib/ui/SettingsSection.svelte";
  import ThemeStrip from "@/features/settings/ThemeStrip.svelte";
  import {
    setPreviewProjectSetting,
    clearPreviewProjectSetting,
  } from "$lib/stores/ui-state.svelte";
  import type { ThemeName } from "$lib/types";

  let {
    currentTheme,
    onCommitTheme,
    sampleCode = "",
  }: {
    currentTheme: string;
    onCommitTheme: (theme: ThemeName) => void;
    sampleCode?: string;
  } = $props();
</script>

<SettingsSection
  title="Theme"
  description="Choose a syntax theme from its live code preview."
>
  <ThemeStrip
    value={currentTheme}
    {sampleCode}
    onPreviewTheme={(theme) => setPreviewProjectSetting("theme", theme)}
    onClearPreviewTheme={() => clearPreviewProjectSetting("theme")}
    onChange={(theme) => {
      clearPreviewProjectSetting("theme");
      onCommitTheme(theme as ThemeName);
    }}
  />
</SettingsSection>
