<script lang="ts">
  /**
   * HighlightLayer — 60fps optimized (Svelte 5 port).
   *
   * React drove the three visual pieces through AnimatePresence with a
   * manual `pieces` memo. Here the same structure is expressed with
   * {#if}/{#key} blocks and per-element transitions:
   *  - dim overlay: mounted while a highlight is active (Tween fades
   *    0 → dimAmount on mount/step change, svelte-fade outro on removal)
   *  - eraser segments: keyed per (highlightId, line) — crossfade on steps
   *  - clone layer: {#key highlight.id} — crossfade on steps
   *
   * `onExitComplete` mirrors AnimatePresence: a counter is armed by every
   * outrostart and released by its outroend; when it drains to zero the
   * callback fires once (useHighlightNav's finishPending is idempotent, and
   * its fail-safe timer covers the "nothing animated" case).
   */
  import type { Highlighter } from "shiki";
  import type { Highlight } from "@/types";
  import { useHighlightPlan } from "@/hooks/useHighlightPlan.svelte";
  import { useHighlightMeasurement } from "@/hooks/useHighlightMeasurement.svelte";
  import HighlightDimOverlay from "./highlights/HighlightDimOverlay.svelte";
  import HighlightEraserSegments from "./highlights/HighlightEraserSegments.svelte";
  import HighlightCloneLayer from "./highlights/HighlightCloneLayer.svelte";

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
    onExitComplete?: () => void;
  } = $props();

  const planHook = useHighlightPlan({
    highlight: () => highlight(),
    code: () => code(),
    highlighter: () => highlighter(),
    theme: () => theme(),
    language: () => language(),
  });

  const measurementHook = useHighlightMeasurement({
    container: () => container(),
    codeContainer: () => codeContainer(),
    plan: () => planHook.plan,
    fontSize: () => fontSize(),
    lineHeight: () => lineHeight(),
    theme: () => theme(),
  });

  const DEFAULT_SIZE_UP_AMOUNT = 125;
  const DEFAULT_DIM_MS = 500;
  const DEFAULT_SIZE_MS = 600;

  const hl = $derived(highlight());

  const dimMs = $derived(
    hl?.useCustomTransition ? hl.dimTransition : DEFAULT_DIM_MS,
  );
  const sizeMs = $derived(
    hl?.useCustomTransition ? hl.sizeUpTransition : DEFAULT_SIZE_MS,
  );
  const dimAmount = $derived((hl?.dimAmount ?? 75) / 100);
  const sizeUpAmount = $derived(hl?.sizeUpAmount ?? DEFAULT_SIZE_UP_AMOUNT);
  const scaleTarget = $derived(
    hl?.sizeUpEnabled && sizeUpAmount > 100
      ? Math.min(Math.max(sizeUpAmount, 100), 300) / 100
      : 1,
  );

  const plan = $derived(planHook.plan);
  const measurement = $derived(measurementHook.measurement);
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

{#if hl}
  <HighlightDimOverlay
    {dimAmount}
    {dimMs}
    onOutroStart={handleOutroStart}
    onOutroEnd={handleOutroEnd}
  />

  {#if plan && measurement && hasSegments}
    <HighlightEraserSegments
      highlightId={hl.id}
      {measurement}
      {plan}
      {dimMs}
      onOutroStart={handleOutroStart}
      onOutroEnd={handleOutroEnd}
    />

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
