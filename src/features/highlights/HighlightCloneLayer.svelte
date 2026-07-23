<script lang="ts">
  /**
   * Floating clone of the selected code that pops toward the viewer.
   *
   * framer ran two tweens on one node (opacity via EASE_DIM over dimDuration,
   * scale via EASE_SCALE/backOut over sizeDuration). Svelte runs one
   * transition per property, so the node is split in two nested divs:
   * outer = opacity fade, inner = scale grow. The parent wraps this
   * component in {#key highlight.id} so step changes crossfade.
   */
  import { fade } from "svelte/transition";
  import type { HighlightMeasurement } from "@/features/highlights/highlight-utils";
  import { EASE_DIM, EASE_SCALE } from "./easings";
  import { grow } from "./transitions";

  let {
    measurement,
    union,
    fontSize,
    lineHeight,
    scaleTarget,
    dimMs,
    sizeMs,
    onOutroStart,
    onOutroEnd,
  }: {
    measurement: HighlightMeasurement;
    union: { x: number; y: number; width: number; height: number };
    fontSize: number;
    lineHeight: number;
    scaleTarget: number;
    dimMs: number;
    sizeMs: number;
    onOutroStart?: () => void;
    onOutroEnd?: () => void;
  } = $props();
</script>

<div
  class="pointer-events-none absolute z-20 font-mono font-medium tracking-wide"
  style="left: {union.x}px; top: {union.y}px; width: {union.width}px; height: {union.height}px; font-size: {fontSize}px; line-height: {lineHeight}; will-change: opacity;"
  transition:fade|global={{ duration: dimMs, easing: EASE_DIM }}
  onoutrostart={onOutroStart}
  onoutroend={onOutroEnd}
>
  <div
    class="h-full w-full"
    style="transform-origin: center center; will-change: transform;"
    transition:grow|global={{ duration: sizeMs, easing: EASE_SCALE, from: 1, to: scaleTarget }}
  >
    {#each measurement.segments as seg (seg.line.lineIndex)}
      <pre
        class="absolute whitespace-pre"
        style="left: {seg.rect.x - union.x}px; top: {seg.rect.y - union.y}px; margin: 0; padding: 0; background: transparent; font-family: inherit; font-size: inherit; line-height: inherit; letter-spacing: inherit;">{@html seg.line.html}</pre>
    {/each}
  </div>
</div>
