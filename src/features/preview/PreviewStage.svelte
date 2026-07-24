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
  style="background-color: {bg}; --code-bg: {bg};"
>
  <div
    class={cn(
      "relative z-10 flex h-full w-full",
      stagePad,
      centerBlock
        ? "items-center justify-center"
        : "items-center justify-start",
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

      /* Isolate the code stage so external layout/style recalcs do not
         interfere with in-flight FLIP token transforms. */
      .shiki-magic-move-container {
        contain: layout style;
      }

      /* Keep Shiki Magic Move's class-driven transitions authoritative even
         if a token span temporarily picks up an inline opacity transition. */
      .shiki-magic-move-container .shiki-magic-move-move {
        transition: all var(--smm-duration, 0.5s) var(--smm-easing, ease) !important;
      }

      .shiki-magic-move-container .shiki-magic-move-enter,
      .shiki-magic-move-container .shiki-magic-move-leave {
        transition: opacity var(--smm-duration, 0.5s) var(--smm-easing, ease) !important;
      }
    </style>
    {@render children?.()}
  </div>
</div>
