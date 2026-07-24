<script lang="ts">
  /**
   * HighlightLayer — 60fps optimized.
   *
   * Two visual pieces, expressed with {#if}/{#key} blocks and per-element
   * transitions:
   *  - dim overlay: mounted while a highlight is active / a step is on
   *    screen (Tween fades 0 → dimAmount on mount/step change, svelte-fade
   *    outro on removal)
   *  - clone layer: {#key visual.id} — swap on steps
   *
   * The original highlighted text is hidden by coverage, not by mutating
   * token span opacity. An eraser rectangle sits above the code and below the
   * dim/clone, filled with the code background. This makes theme re-keys
   * safe: Shiki can destroy/recreate token spans and the selected glyphs stay
   * covered without identity bookkeeping.
   *
   * Step changes OVERLAP: the incoming intro starts together with the
   * outgoing outro. Rendering never follows the async plan/measurement
   * pipeline directly — `visual` snapshots the last step that was fully
   * measured (identity-checked against its plan) and only swaps when the
   * INCOMING step is ready. Anything that was ever on screen therefore
   * keeps a real, measured clone that ALWAYS plays its outro; a click
   * landing mid-tokenize simply never mounts the skipped step (its intro
   * is what would have been killed, not the visible clone's outro).
   *
   * `onExitComplete` mirrors AnimatePresence: a counter is armed by every
   * outrostart and released by every outroend; when it drains to zero the
   * callback fires once. createHighlightNav's finishPending is idempotent,
   * and its fail-safe timer covers the "nothing animated" case.
   */
  import type { Highlighter } from "shiki";
  import type { Highlight } from "$lib/types";
  import { createHighlightPlan } from "@/features/highlights/highlight-plan.svelte";
  import { createHighlightMeasurement } from "@/features/highlights/highlight-measurement.svelte";
  import {
    measurementMatchesPlan,
    type HighlightMeasurement,
  } from "@/features/highlights/highlight-utils";
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
    onExitComplete,
    globalDimAmount,
    globalSizeUpAmount,
    globalDimColor = "black",
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
    globalDimAmount?: number;
    globalSizeUpAmount?: number;
    globalDimColor?: "black" | "theme";
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
   * The step actually on screen: a snapshot of the last fully measured
   * step, kept until the incoming step is ready (see the header). Same-id
   * refreshes (live preview edits, re-measures) overwrite the snapshot
   * without re-keying the clone.
   *
   * `visual` is RETAINED forever once set — it never goes back to null.
   * The clone's props are lazy getters in dev builds, and Svelte
   * re-evaluates transition params at outro START (introend clears the
   * cached options): if `visual` were nulled when the last clone unmounts,
   * those re-reads would hit `null.sizeMs` and crash the boundary. The
   * separate `shown` flag gates the block instead, so every lazy re-read
   * during an outro resolves against the valid outgoing snapshot (with the
   * correct durations).
   */
  const plan = $derived(planCtl.plan);
  const measurement = $derived(measurementCtl.measurement);
  const union = $derived(measurement?.union);
  const hasSegments = $derived(
    Boolean(plan && measurement && measurement.segments.length > 0),
  );
  const incomingReady = $derived(
    Boolean(
      hl &&
      plan &&
      measurement &&
      union &&
      hasSegments &&
      measurementMatchesPlan(plan, measurement),
    ),
  );
  /** hl set but not measured yet — the OLD snapshot is still on screen. */
  const waiting = $derived(Boolean(hl && !incomingReady));

  let visual = $state<{
    id: string;
    hl: Highlight;
    measurement: HighlightMeasurement;
    union: HighlightMeasurement["union"];
    scaleTarget: number;
    dimMs: number;
    sizeMs: number;
  } | null>(null);
  let shown = $state(false);

  /**
   * Last non-null highlight seen; keeps the dim's amount/duration from
   * dipping to defaults while a final outro fades (hl is already null).
   */
  let seenHl: Highlight | null = null;
  $effect(() => {
    if (hl) seenHl = hl;
  });

  const dimSource = $derived(waiting ? (visual?.hl ?? hl) : (hl ?? seenHl));
  const dimMs = $derived(
    dimSource?.useCustomTransition ? dimSource.dimTransition : DEFAULT_DIM_MS,
  );

  const dimAmount = $derived(
    (globalDimAmount ?? dimSource?.dimAmount ?? 75) / 100,
  );
  const sizeUpAmount = $derived(
    globalSizeUpAmount ?? hl?.sizeUpAmount ?? DEFAULT_SIZE_UP_AMOUNT,
  );
  const scaleTarget = $derived(
    hl?.sizeUpEnabled && sizeUpAmount > 100
      ? Math.min(Math.max(sizeUpAmount, 100), 300) / 100
      : 1,
  );

  // Swap/readiness gate — swap only when the incoming step is measured.
  // Snapshot settings from the highlight ITSELF (never from dimSource,
  // which derives from `visual` — that chain would be circular here).
  $effect(() => {
    const cur = hl;
    if (!cur) {
      shown = false;
      return;
    }
    if (!incomingReady) return;
    visual = {
      id: cur.id,
      hl: cur,
      measurement: measurement!,
      union: union!,
      scaleTarget,
      dimMs: cur.useCustomTransition ? cur.dimTransition : DEFAULT_DIM_MS,
      sizeMs: cur.useCustomTransition ? cur.sizeUpTransition : DEFAULT_SIZE_MS,
    };
    shown = true;
  });

  /** AnimatePresence-style exit bookkeeping. */
  let pendingExits = 0;

  function handleOutroStart() {
    pendingExits += 1;
  }

  function handleOutroEnd() {
    pendingExits = Math.max(0, pendingExits - 1);
    if (pendingExits === 0) onExitComplete?.();
  }
</script>

<!-- ERASER: hide the ORIGINAL selected text by COVERAGE, not by per-span
     opacity. It sits above the code and below the dim/clone, filled with the
     stage code background so that under the dim it equals the surrounding
     dimmed background. Because it covers instead of mutating token spans, it
     survives shiki-magic-move recreating the tokens on theme hover/commit. -->
{#if shown && visual}
  <div
    class="pointer-events-none absolute"
    style="left: 0; top: 0; z-index: 15;"
    aria-hidden="true"
  >
    {#each visual.measurement.segments as seg (seg.line.lineIndex)}
      <div
        class="absolute"
        data-highlight-eraser="true"
        style="left: {seg.rect.x}px; top: {seg.rect.y}px; width: {seg.rect
          .width}px; height: {seg.rect
          .height}px; background-color: var(--code-bg);"
      ></div>
    {/each}
  </div>
{/if}

{#if hl}
  <HighlightDimOverlay
    {dimAmount}
    {dimMs}
    dimColor={globalDimColor}
    onOutroStart={handleOutroStart}
    onOutroEnd={handleOutroEnd}
  />
{/if}

{#if shown && visual}
  {#key visual.id}
    <!-- Capture the snapshot: props are lazy getters in dev builds and
         Svelte re-reads transition params when the outro starts. -->
    {@const e = visual}
    <HighlightCloneLayer
      measurement={e.measurement}
      union={e.union}
      fontSize={fontSize()}
      lineHeight={lineHeight()}
      scaleTarget={e.scaleTarget}
      dimMs={e.dimMs}
      sizeMs={e.sizeMs}
      onOutroStart={handleOutroStart}
      onOutroEnd={handleOutroEnd}
    />
  {/key}
{/if}
