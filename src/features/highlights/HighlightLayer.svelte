<script lang="ts">
  /**
   * HighlightLayer — 60fps optimized.
   *
   * Two visual pieces, expressed with {#if}/{#key} blocks and per-element
   * transitions:
   *  - dim overlay: mounted while a highlight is active OR `spotlightActive`
   *    holds it across a step gap (Tween fades 0 → dimAmount on mount/step
   *    change, svelte-fade outro on removal)
   *  - clone layer: {#key highlight.id} — swap on steps
   *
   * There is deliberately NO eraser panel under the clone: painting an
   * opaque box over the original text read as a black slab. Instead the
   * ORIGINAL token spans of the selection fade to opacity 0 in sync with
   * the dim (createHighlightUnderlay), so only the bright clone shows in
   * that spot — no box, no echo.
   *
   * Step changes are sequenced by createHighlightNav (outro fully, then
   * intro): the nav parks the index at -1 with `spotlightActive` still true,
   * so only the clone unmounts here while the dim stays put.
   *
   * `onExitComplete` mirrors AnimatePresence: a counter is armed by every
   * outrostart and released by its outroend; when it drains to zero the
   * callback fires once (createHighlightNav's finishPending is idempotent, and
   * its fail-safe timer covers the "nothing animated" case).
   */
  import type { Highlighter } from "shiki";
  import type { Highlight } from "$lib/types";
  import { createHighlightPlan } from "@/features/highlights/highlight-plan.svelte";
  import { createHighlightMeasurement } from "@/features/highlights/highlight-measurement.svelte";
  import { createHighlightUnderlay } from "@/features/highlights/highlight-underlay.svelte";
  import HighlightDimOverlay from "@/features/highlights/HighlightDimOverlay.svelte";
  import HighlightCloneLayer from "@/features/highlights/HighlightCloneLayer.svelte";

  let {
    container,
    codeContainer,
    code,
    highlight,
    highlighter,
    theme,
    language,
    fontSize,
    lineHeight,
    spotlightActive = false,
    onExitComplete,
  }: {
    container: () => HTMLElement | null;
    codeContainer: () => HTMLElement | null;
    code: () => string;
    highlight: () => Highlight | null;
    highlighter: () => Highlighter | null;
    theme: () => string;
    language: () => string;
    fontSize: () => number;
    lineHeight: () => number;
    /** Nav holds the dim across a step gap (outro → intro). */
    spotlightActive?: boolean;
    onExitComplete?: () => void;
  } = $props();

  const planCtl = createHighlightPlan({
    highlight: () => highlight(),
    code: () => code(),
    highlighter: () => highlighter(),
    theme: () => theme(),
    language: () => language(),
  });

  const measurementCtl = createHighlightMeasurement({
    container: () => container(),
    codeContainer: () => codeContainer(),
    plan: () => planCtl.plan,
    fontSize: () => fontSize(),
    lineHeight: () => lineHeight(),
    theme: () => theme(),
  });

  const DEFAULT_SIZE_UP_AMOUNT = 125;
  const DEFAULT_DIM_MS = 500;
  const DEFAULT_SIZE_MS = 600;

  const hl = $derived(highlight());

  /**
   * Last non-null highlight seen. The nav drops hl to null during a step
   * gap while the dim stays mounted; deriving the dim's amount/duration
   * from this cache prevents a visible dip to the defaults mid-gap (and
   * keeps custom dim durations on the final outro).
   */
  let seenHl: Highlight | null = null;
  $effect(() => {
    if (hl) seenHl = hl;
  });
  const dimSource = $derived(hl ?? seenHl);

  const dimMs = $derived(
    dimSource?.useCustomTransition ? dimSource.dimTransition : DEFAULT_DIM_MS,
  );
  const sizeMs = $derived(
    hl?.useCustomTransition ? hl.sizeUpTransition : DEFAULT_SIZE_MS,
  );
  const dimAmount = $derived((dimSource?.dimAmount ?? 75) / 100);
  const sizeUpAmount = $derived(hl?.sizeUpAmount ?? DEFAULT_SIZE_UP_AMOUNT);
  const scaleTarget = $derived(
    hl?.sizeUpEnabled && sizeUpAmount > 100
      ? Math.min(Math.max(sizeUpAmount, 100), 300) / 100
      : 1,
  );

  const plan = $derived(planCtl.plan);
  const measurement = $derived(measurementCtl.measurement);

  // Fade the original text chunk under the clone (under-fade to 0).
  createHighlightUnderlay({
    codeContainer: () => codeContainer(),
    measurement: () => measurementCtl.measurement,
    dimMs: () => dimMs,
  });
  const hasSegments = $derived(
    Boolean(plan && measurement && measurement.segments.length > 0),
  );
  const union = $derived(measurement?.union);

  /* AnimatePresence-style exit bookkeeping. */
  let pendingExits = 0;

  function handleOutroStart() {
    pendingExits += 1;
  }

  function handleOutroEnd() {
    pendingExits = Math.max(0, pendingExits - 1);
    if (pendingExits === 0) onExitComplete?.();
  }
</script>

{#if hl || spotlightActive}
  <HighlightDimOverlay
    {dimAmount}
    {dimMs}
    onOutroStart={handleOutroStart}
    onOutroEnd={handleOutroEnd}
  />
{/if}

{#if hl}
  {#if plan && measurement && hasSegments}
    {#if union}
      {#key hl.id}
        <HighlightCloneLayer
          {measurement}
          {union}
          fontSize={fontSize()}
          lineHeight={lineHeight()}
          {scaleTarget}
          {dimMs}
          {sizeMs}
          onOutroStart={handleOutroStart}
          onOutroEnd={handleOutroEnd}
        />
      {/key}
    {/if}
  {/if}
{/if}
