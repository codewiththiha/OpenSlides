<script lang="ts">
  import { Check } from "@lucide/svelte";
  import CodeThumbnail from "$lib/ui/CodeThumbnail.svelte";
  import { shikiDisplayHtml } from "$lib/shiki/shiki-display.svelte";
  import type { ThemeName } from "$lib/types";
  import { cn } from "$lib/lib/utils";

  let {
    value,
    label,
    selected,
    onSelect,
    onPreview,
    onPreviewEnd,
    sample,
  }: {
    value: ThemeName;
    label: string;
    selected: boolean;
    onSelect: () => void;
    onPreview: () => void;
    onPreviewEnd: () => void;
    sample: string;
  } = $props();

  const tile = shikiDisplayHtml(() => ({
    code: sample,
    language: "typescript",
    theme: value,
    resetKey: `theme-tile-${value}`,
    priority: "low",
    debounceMs: 40,
    policyName: "previewTile",
  }));
</script>

<button
  type="button"
  onclick={onSelect}
  onmouseenter={onPreview}
  onmouseleave={onPreviewEnd}
  onfocus={onPreview}
  onblur={onPreviewEnd}
  class={cn(
    "group relative shrink-0 overflow-hidden rounded-lg border text-left transition-all duration-150",
    "w-[120px]",
    selected
      ? "border-primary ring-2 ring-primary/35"
      : "border-border/70 hover:-translate-y-0.5 hover:border-primary/50",
  )}
  title="Use {label}"
  aria-pressed={selected}
>
  <CodeThumbnail
    html={tile.html}
    theme={value}
    fontSize={6.5}
    lineHeight={1.35}
    class="h-[80px] w-full p-2"
    codeClassName="!absolute left-1/2 top-1/2 !inline-block -translate-x-1/2 -translate-y-1/2"
  >
    {#snippet fallback()}
      <span class="block text-center font-mono text-[9px] text-muted-foreground"
        >···</span
      >
    {/snippet}
  </CodeThumbnail>
  <div class="flex items-center justify-between bg-card px-2 py-1.5">
    <span class="truncate text-[10px] font-medium">{label}</span>
    {#if selected}
      <Check class="h-3.5 w-3.5 shrink-0 text-primary" />
    {/if}
  </div>
</button>
