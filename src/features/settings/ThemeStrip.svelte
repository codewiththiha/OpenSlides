<script lang="ts">
  import type { ThemeName } from "$lib/types";
  import { THEMES, type ThemeMeta } from "$lib/lib/themes";
  import ThemeTile from "./ThemeTile.svelte";
  import { cn } from "$lib/lib/utils";

  let {
    value,
    onChange,
    onPreviewTheme,
    onClearPreviewTheme,
    sampleCode,
  }: {
    value: string;
    onChange: (theme: ThemeName) => void;
    onPreviewTheme: (theme: ThemeName) => void;
    onClearPreviewTheme: () => void;
    sampleCode: string;
  } = $props();

  let filter = $state<"all" | "dark" | "light">("all");

  const filtered = $derived(
    THEMES.filter((t: ThemeMeta) => {
      if (filter === "dark") return !t.light;
      if (filter === "light") return t.light;
      return true;
    }),
  );
</script>

<div class="space-y-3">
  <!-- Horizontal scroll strip -->
  <div
    class="flex [scrollbar-width:none] gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
  >
    {#each filtered as theme (theme.value)}
      <ThemeTile
        value={theme.value}
        label={theme.label}
        selected={value === theme.value}
        sample={sampleCode}
        onSelect={() => onChange(theme.value)}
        onPreview={() => onPreviewTheme(theme.value)}
        onPreviewEnd={onClearPreviewTheme}
      />
    {/each}
  </div>

  <!-- Filter row -->
  <div class="flex items-center gap-2 text-[10px] text-muted-foreground">
    {#each ["all", "dark", "light"] as f (f)}
      <button
        type="button"
        onclick={() => (filter = f as any)}
        class={cn(
          "rounded-full px-2.5 py-0.5 capitalize transition-colors",
          filter === f
            ? "bg-primary/15 font-medium text-primary"
            : "hover:bg-muted",
        )}
        aria-pressed={filter === f}
      >
        {f}
      </button>
    {/each}
  </div>
</div>
