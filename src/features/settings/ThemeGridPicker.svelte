<script lang="ts">
  /** A compact theme control that opens the visual Shiki theme gallery on demand. */
  import { ChevronDown, Palette } from "@lucide/svelte";
  import ThemeTile from "./ThemeTile.svelte";
  import { THEMES } from "$lib/lib/themes";
  import type { ThemeName } from "$lib/types";
  import { cn } from "$lib/lib/utils";

  const THEME_SAMPLE = `const makeSlide = (idea: string) => {
  return \`Present: \${"idea"}\`;
};`;

  let {
    value,
    onChange,
    onPreviewTheme,
    onClearPreviewTheme,
  }: {
    value: string;
    onChange: (theme: ThemeName) => void;
    onPreviewTheme: (theme: ThemeName) => void;
    onClearPreviewTheme: () => void;
  } = $props();

  let isOpen = $state(false);
  const selected = $derived(
    THEMES.find((theme) => theme.value === value) ?? THEMES[0],
  );
</script>

<div class="space-y-3">
  <button
    type="button"
    onclick={() => {
      if (isOpen) onClearPreviewTheme();
      isOpen = !isOpen;
    }}
    class="flex w-full items-center justify-between rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
    aria-expanded={isOpen}
  >
    <span class="flex items-center gap-2">
      <span
        class="h-3 w-3 rounded-full border border-black/10"
        style="background-color: {selected.background};"
      ></span>
      <span>{selected.label}</span>
    </span>
    <span class="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Palette class="h-3.5 w-3.5" />
      Browse themes
      <ChevronDown
        class={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")}
      />
    </span>
  </button>

  {#if isOpen}
    <div class="grid grid-cols-2 gap-2">
      {#each THEMES as theme (theme.value)}
        <ThemeTile
          value={theme.value}
          label={theme.label}
          selected={value === theme.value}
          sample={THEME_SAMPLE}
          onSelect={() => {
            onChange(theme.value);
            isOpen = false;
          }}
          onPreview={() => onPreviewTheme(theme.value)}
          onPreviewEnd={onClearPreviewTheme}
        />
      {/each}
    </div>
  {/if}
</div>
