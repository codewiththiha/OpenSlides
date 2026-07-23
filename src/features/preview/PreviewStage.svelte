<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "$lib/lib/utils";

  let {
    ref = $bindable(null),
    bg,
    stagePad,
    centerBlock,
    children,
  }: {
    ref?: HTMLDivElement | null;
    bg: string;
    stagePad: string;
    centerBlock: boolean;
    children?: Snippet;
  } = $props();
</script>

<div
  bind:this={ref}
  class="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl shadow-2xl transition-colors duration-500"
  style="background-color: {bg}"
>
  <div
    class={cn(
      "relative z-10 flex h-full w-full",
      stagePad,
      centerBlock ? "items-center justify-center" : "items-center justify-start",
    )}
  >
    <style>
      .shiki-magic-move-container,
      .shiki-magic-move-container pre,
      .shiki-magic-move-container code {
        background-color: transparent !important;
        white-space: pre !important;
        display: block !important;
        line-height: var(--line-height) !important;
        font-size: var(--font-size) !important;
        text-align: left !important;
      }
    </style>
    {@render children?.()}
  </div>
</div>
