<script lang="ts">
  /**
   * Per-line "eraser" boxes painted in the card background color over the
   * old code so only the highlighted selection remains visible.
   *
   * Keyed per (highlightId, line) — on step change the old boxes fade out
   * while the new ones fade in, matching the AnimatePresence crossfade.
   */
  import { fade } from "svelte/transition";
  import type { HighlightMeasurement } from "@/lib/highlight-utils";
  import type { HighlightPlan } from "@/lib/highlight-tokens";
  import { EASE_DIM } from "./easings";

  let {
    highlightId,
    measurement,
    plan,
    dimMs,
    onOutroStart,
    onOutroEnd,
  }: {
    highlightId: string;
    measurement: HighlightMeasurement;
    plan: HighlightPlan;
    dimMs: number;
    onOutroStart?: () => void;
    onOutroEnd?: () => void;
  } = $props();
</script>

{#each measurement.segments as seg (`${highlightId}-eraser-${seg.line.lineIndex}`)}
  <div
    class="pointer-events-none absolute z-20"
    style="left: {seg.rect.x}px; top: {seg.rect.y}px; width: {seg.rect.width}px; height: {seg.rect.height}px; background-color: {plan.eraserColor}; will-change: opacity; transform: translateZ(0);"
    transition:fade|global={{ duration: dimMs, easing: EASE_DIM }}
    onoutrostart={onOutroStart}
    onoutroend={onOutroEnd}
  ></div>
{/each}
