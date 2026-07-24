<script lang="ts">
  /** Theme section of the settings drawer (§6.9). */
  import SettingsSection from "$lib/ui/SettingsSection.svelte";
  import ThemeGridPicker from "@/features/settings/ThemeGridPicker.svelte";
  import { clearPreviewProjectSetting } from "$lib/stores/ui-state.svelte";
  import type { ThemeName } from "$lib/types";

  let {
    currentTheme,
    onCommitTheme,
    onPreviewTheme,
    onClearPreviewTheme,
  }: {
    currentTheme: string;
    onCommitTheme: (theme: ThemeName) => void;
    onPreviewTheme: (theme: ThemeName) => void;
    onClearPreviewTheme: () => void;
  } = $props();
</script>

<SettingsSection title="Theme">
  <ThemeGridPicker
    value={currentTheme}
    {onPreviewTheme}
    {onClearPreviewTheme}
    onChange={(theme) => {
      clearPreviewProjectSetting("theme");
      onCommitTheme(theme as ThemeName);
    }}
  />
</SettingsSection>
