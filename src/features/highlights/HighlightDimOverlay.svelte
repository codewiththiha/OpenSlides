<script lang="ts">
  /**
   * Full-stage dim behind an active highlight.
   *
   * One element stays mounted across steps; a `Tween` runs one set() on
   * mount (0 → dimAmount intro) and on every step change. Removal fades
   * the element out from its current opacity (svelte `fade` reads it at
   * outro start).
   */
  import { untrack } from "svelte";
  import { Tween } from "svelte/motion";
  import { fade } from "svelte/transition";
  import { EASE_DIM } from "$lib/lib/easings";

  let {
    dimAmount,
    dimMs,
    dimColor = "black",
    onOutroStart,
    onOutroEnd,
  }: {
    dimAmount: number;
    dimMs: number;
    dimColor?: "black" | "theme";
    onOutroStart?: () => void;
    onOutroEnd?: () => void;
  } = $props();

  // Constructor default duration only; every set() passes the live dimMs
  // again. untrack() marks the capture as deliberate.
  const opacity = new Tween(0, {
    duration: untrack(() => dimMs),
    easing: EASE_DIM,
  });

  $effect(() => {
    void opacity.set(dimAmount, {
      duration: dimMs,
      easing: EASE_DIM,
    });
  });
</script>

<div
  class="pointer-events-none absolute inset-0 z-20"
  style="
    background-color: {dimColor === 'black'
    ? 'rgba(0, 0, 0, 1)'
    : 'var(--code-bg, rgba(0,0,0,1))'};
    will-change: opacity;
    opacity: {opacity.current};
  "
  out:fade|global={{ duration: dimMs, easing: EASE_DIM }}
  onoutrostart={onOutroStart}
  onoutroend={onOutroEnd}
></div>
