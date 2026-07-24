<script lang="ts">
  /** Back-compat wrapper: the old strip is now the full visual grid picker. */
  import ThemeGridPicker from "./ThemeGridPicker.svelte";
  import type { ThemeName } from "$lib/types";

  let {
    value,
    onChange,
    onPreviewTheme,
    onClearPreviewTheme,
    sampleCode = "",
  }: {
    value: string;
    onChange: (theme: ThemeName) => void;
    onPreviewTheme: (theme: ThemeName) => void;
    onClearPreviewTheme: () => void;
    sampleCode?: string;
  } = $props();
</script>

<ThemeGridPicker
  {value}
  {sampleCode}
  {onChange}
  {onPreviewTheme}
  {onClearPreviewTheme}
/>
