<script lang="ts">
  import TwoOptionPicker from "$lib/ui/TwoOptionPicker.svelte";
  import { themeBackground } from "$lib/types";

  let {
    value,
    theme,
    onPreview,
    onPreviewEnd,
    onCommit,
  }: {
    value: "black" | "theme";
    theme: string;
    onPreview?: (v: "black" | "theme") => void;
    onPreviewEnd?: () => void;
    onCommit: (v: "black" | "theme") => void;
  } = $props();

  const options = $derived([
    { value: "black", label: "Black", swatch: "#000000" },
    { value: "theme", label: "Theme", swatch: themeBackground(theme) },
  ] as const);
</script>

<TwoOptionPicker
  ariaLabel="Highlight dim color"
  {value}
  {options}
  onPreview={(next) => onPreview?.(next as "black" | "theme")}
  {onPreviewEnd}
  onCommit={(next) => onCommit(next as "black" | "theme")}
/>
