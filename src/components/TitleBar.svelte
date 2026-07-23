<script lang="ts">
  /**
   * In-app toolbar strip. Window chrome (traffic lights / caption buttons)
   * is handled by the OS via native decorations — no custom window controls.
   */
  import type { Snippet } from "svelte";
  import { cn } from "@/lib/utils";

  let {
    title,
    class: className,
    leading,
    trailing,
    borderless,
  }: {
    title?: string;
    class?: string;
    leading?: Snippet;
    trailing?: Snippet;
    /** When true, omit the bottom border (merged into a single bar). */
    borderless?: boolean;
  } = $props();
</script>

<div
  class={cn(
    "flex h-11 shrink-0 items-center justify-between gap-3 bg-card/70 px-3 backdrop-blur-md",
    !borderless && "border-b border-border/60",
    className,
  )}
>
  <div class="flex min-w-0 items-center gap-2">
    {@render leading?.()}
    {#if title}
      <span class="truncate text-sm font-medium text-foreground/90">{title}</span>
    {/if}
  </div>
  <div class="flex shrink-0 items-center gap-1">{@render trailing?.()}</div>
</div>
