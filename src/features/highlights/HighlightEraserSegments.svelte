<script lang="ts">
  /**
   * Per-line "eraser" boxes painted in the card background color over the
   * old code so only the highlighted selection remains visible.
   *
   * Keyed per (highlightId, line). Intro-only fade: on step change or
   * removal the boxes vanish instantly — the clone text's own fade already
   * carries the outro, and a lingering solid panel reads as a black slab
   * under the fading text.
   */
  import { fade } from "svelte/transition";
  import type { HighlightMeasurement } from "@/features/highlights/highlight-utils";
  import type { HighlightPlan } from "@/features/highlights/highlight-tokens";
  import { EASE_DIM } from "$lib/lib/easings";

  let {
    highlightId,
    measurement,
    plan,
    dimMs,
  }: {
    highlightId: string;
    measurement: HighlightMeasurement;
    plan: HighlightPlan;
    dimMs: number;
  } = $props();
</script>

{#each measurement.segments as seg (`${highlightId}-eraser-${seg.line.lineIndex}`)}
  <div
    class="pointer-events-none absolute z-20"
    style="left: {seg.rect.x}px; top: {seg.rect.y}px; width: {seg.rect
      .width}px; height: {seg.rect
      .height}px; background-color: {plan.eraserColor}; will-change: opacity; transform: translateZ(0);"
    in:fade|global={{ duration: dimMs, easing: EASE_DIM }}
  ></div>
{/each}
