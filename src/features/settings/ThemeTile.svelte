<script lang="ts">
  import { Check } from "@lucide/svelte";
  import CodeThumbnail from "$lib/ui/CodeThumbnail.svelte";
  import { shikiDisplayHtml } from "$lib/shiki/shiki-display.svelte";
  import type { ThemeName } from "$lib/types";
  import { cn } from "$lib/lib/utils";

  let {
    value,
    label,
    background,
    selected,
    onSelect,
    onPreview,
    onPreviewEnd,
    sample,
    dataIndex,
    tabIndex = 0,
  }: {
    value: ThemeName;
    label: string;
    background: string;
    selected: boolean;
    onSelect: () => void;
    onPreview: () => void;
    onPreviewEnd: () => void;
    sample: string;
    dataIndex: number;
    tabIndex?: number;
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
  role="radio"
  onclick={onSelect}
  onmouseenter={onPreview}
  onmouseleave={onPreviewEnd}
  onfocus={onPreview}
  onblur={onPreviewEnd}
  class={cn(
    "group relative overflow-hidden rounded-lg text-left focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none motion-safe:transition-all motion-safe:duration-200 motion-reduce:transition-none",
    selected
      ? "scale-[1.02] border-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
      : "border border-border/70 hover:scale-[1.03] hover:border-primary/50 hover:shadow-md",
  )}
  style={selected ? `border-color: ${background};` : undefined}
  title="Use {label}"
  aria-checked={selected}
  tabindex={tabIndex}
  data-theme-index={dataIndex}
>
  <CodeThumbnail
    html={tile.html}
    theme={value}
    fontSize={8.25}
    lineHeight={1.38}
    class="h-[110px] w-full p-3 opacity-[0.85] transition-opacity group-hover:opacity-100"
    codeClassName="!absolute left-1/2 top-1/2 !inline-block max-w-[90%] -translate-x-1/2 -translate-y-1/2"
  >
    {#snippet fallback()}
      <span
        class="block text-center font-mono text-[10px] text-muted-foreground"
      >
        ···
      </span>
    {/snippet}
  </CodeThumbnail>

  {#if selected}
    <span
      class="absolute top-2 right-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-background/85 text-primary shadow-lg backdrop-blur-sm"
      aria-hidden="true"
    >
      <Check class="h-3.5 w-3.5" />
    </span>
  {/if}

  <div class="bg-card/95 px-2.5 py-2 backdrop-blur-sm">
    <span class="block truncate text-[11px] font-medium">{label}</span>
  </div>
</button>
