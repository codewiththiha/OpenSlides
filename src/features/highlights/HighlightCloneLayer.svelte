<script lang="ts">
  /**
   * Floating clone of the selected code that pops toward the viewer.
   *
   * framer ran two tweens on one node (opacity via EASE_DIM over dimDuration,
   * scale via EASE_SCALE/backOut over sizeDuration). Svelte runs one
   * transition per property, so the node is split in two nested divs:
   * outer = opacity fade, inner = scale grow. The parent wraps this
   * component in {#key highlight.id} so step changes crossfade.
   *
   * The inner div carries a persistent `transform: scale(scaleTarget)` as its
   * resting state: Svelte transitions only style the node while the WAAPI
   * animation runs and cancel it on finish, so without an inline transform
   * the clone would snap back to scale 1 the instant the intro ends. The
   * running animation overrides the inline style (1 → scaleTarget), then the
   * hand-off at the identical end value is seamless. The outro (scaleTarget →
   * 1) therefore only plays when the keyed block swaps or the highlight is
   * removed — never right after the intro.
   */
  import { untrack } from "svelte";
  import { fade } from "svelte/transition";
  import type { HighlightMeasurement } from "@/features/highlights/highlight-utils";
  import { EASE_DIM, EASE_SCALE } from "$lib/lib/easings";
  import { grow } from "$lib/ui/transitions/grow";

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

  // Svelte evaluates transition options outside a reactive context during
  // outros. Copy prop values into plain state so those late reads don't touch
  // inert prop-derived getters.
  let fadeMs = $state(untrack(() => dimMs));
  let growMs = $state(untrack(() => sizeMs));
  let transitionScale = $state(untrack(() => scaleTarget));

  $effect(() => {
    fadeMs = dimMs;
    growMs = sizeMs;
    transitionScale = scaleTarget;
  });
</script>

<div
  class="pointer-events-none absolute z-20 font-mono font-medium tracking-wide"
  style="left: {union.x}px; top: {union.y}px; width: {union.width}px; height: {union.height}px; font-size: {fontSize}px; line-height: {lineHeight}; will-change: opacity;"
  transition:fade|global={{ duration: fadeMs, easing: EASE_DIM }}
  onoutrostart={onOutroStart}
  onoutroend={onOutroEnd}
>
  <div
    class="h-full w-full"
    style="transform-origin: center center; transform: scale({scaleTarget}); will-change: transform;"
    transition:grow|global={{
      duration: growMs,
      easing: EASE_SCALE,
      from: 1,
      to: transitionScale,
    }}
  >
    {#each measurement.segments as seg (seg.line.lineIndex)}
      <pre
        class="absolute whitespace-pre"
        style="left: {seg.rect.x - union.x}px; top: {seg.rect.y -
          union.y}px; margin: 0; padding: 0; background: transparent; font-family: inherit; font-size: inherit; line-height: inherit; letter-spacing: inherit;">{@html seg
          .line.html}</pre>
    {/each}
  </div>
</div>
