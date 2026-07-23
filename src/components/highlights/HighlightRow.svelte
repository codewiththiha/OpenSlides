<script lang="ts">
  import type { Snippet } from "svelte";
  import {
    ArrowDown,
    ArrowUp,
    ChevronDown,
    ChevronUp,
    Eye,
    Trash2,
  } from "@lucide/svelte";
  import Button from "../ui/Button.svelte";
  import { cn } from "@/lib/utils";
  import HighlightSettingsForm from "./HighlightSettingsForm.svelte";
  import { EASE_DIM } from "./easings";
  import type { Highlight } from "@/types";

  let {
    highlight,
    index,
    total,
    snippet,
    isExpanded,
    isPreviewing,
    dragHandle,
    onToggleExpand,
    onMove,
    onPreview,
    onDelete,
    onUpdate,
  }: {
    highlight: Highlight;
    index: number;
    total: number;
    snippet?: string;
    isExpanded: boolean;
    isPreviewing: boolean;
    dragHandle?: Snippet;
    onToggleExpand: (id: string) => void;
    onMove: (id: string, direction: -1 | 1) => void;
    onPreview: (index: number) => void;
    onDelete: (id: string) => void;
    onUpdate: (id: string, patch: Partial<Highlight>) => void;
  } = $props();

  const text = $derived(
    snippet === undefined
      ? "…"
      : snippet.replace(/\s+/g, " ").trim() || "(empty selection)",
  );

  /** framer's height 0→auto + fade in 150ms, as a Svelte transition. */
  function expand(
    node: Element,
    { duration = 150, easing = EASE_DIM }: { duration?: number; easing?: (t: number) => number } = {},
  ) {
    const el = node as HTMLElement;
    const height = el.offsetHeight;
    const opacity = +getComputedStyle(el).opacity;
    return {
      duration,
      easing,
      css: (t: number) =>
        `overflow: hidden; height: ${t * height}px; opacity: ${t * opacity}`,
    };
  }
</script>

<div
  class={cn(
    "rounded-md border transition-colors",
    isPreviewing
      ? "border-primary/60 bg-primary/10"
      : isExpanded
        ? "border-primary/40 bg-card/80"
        : "border-border/40 bg-card/40 hover:bg-card/60",
  )}
>
  <div class="flex items-center gap-1 px-2 py-1">
    {@render dragHandle?.()}
    <button
      type="button"
      class="flex min-w-0 flex-1 items-center gap-1.5 text-left"
      onclick={() => onToggleExpand(highlight.id)}
      title="L{highlight.startLine + 1}:{highlight.startChar} → L{highlight.endLine +
        1}:{highlight.endChar}"
    >
      <span class="shrink-0 font-mono text-[10px] text-primary/80">#{index + 1}</span>
      <span class="truncate font-mono text-[10px] text-foreground/80">{text}</span>
    </button>
    <Button
      variant="ghost"
      size="icon"
      class="h-5 w-5 shrink-0"
      disabled={index === 0}
      onclick={() => onMove(highlight.id, -1)}
    >
      <ArrowUp class="h-3 w-3" />
    </Button>
    <Button
      variant="ghost"
      size="icon"
      class="h-5 w-5 shrink-0"
      disabled={index === total - 1}
      onclick={() => onMove(highlight.id, 1)}
    >
      <ArrowDown class="h-3 w-3" />
    </Button>
    <Button
      variant="ghost"
      size="icon"
      class={cn("h-5 w-5 shrink-0", isPreviewing && "bg-primary/20 text-primary")}
      onclick={() => onPreview(index)}
    >
      <Eye class="h-3 w-3" />
    </Button>
    <Button
      variant="ghost"
      size="icon"
      class="h-5 w-5 shrink-0"
      onclick={() => onToggleExpand(highlight.id)}
    >
      {#if isExpanded}
        <ChevronUp class="h-3 w-3" />
      {:else}
        <ChevronDown class="h-3 w-3" />
      {/if}
    </Button>
    <Button
      variant="ghost"
      size="icon"
      class="h-5 w-5 shrink-0 hover:text-destructive"
      onclick={() => onDelete(highlight.id)}
    >
      <Trash2 class="h-3 w-3" />
    </Button>
  </div>
  {#if isExpanded}
    <div class="px-2 pb-2" transition:expand={{}}>
      <HighlightSettingsForm {highlight} {onUpdate} />
    </div>
  {/if}
</div>
