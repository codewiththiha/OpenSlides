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
   * There is deliberately NO eraser panel under the clone: painting an
   * opaque box over the original text read as a black slab. Instead the
   * ORIGINAL token spans of the selection fade to opacity 0 in sync with
   * the dim (createHighlightUnderlay), so only the bright clone shows in
   * that spot — no box, no echo.
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
   * outrostart AND every underlay restore, and released by its
   * outroend/restore-settle; when it drains to zero the callback fires
   * once (createHighlightNav's finishPending is idempotent, and its
   * fail-safe timer covers the "nothing animated" case). Restores are
   * part of the count so a queued slide morph never starts while an
   * original token span is still mid-restore or carrying the inline
   * transition that would break shiki-magic-move's class transitions.
   */
  import type { Highlighter } from "shiki";
  import { HIGHLIGHT_DEFAULTS, type Highlight } from "$lib/types";
  import { createHighlightPlan } from "@/features/highlights/highlight-plan.svelte";
  import { createHighlightMeasurement } from "@/features/highlights/highlight-measurement.svelte";
  import { createHighlightUnderlay } from "@/features/highlights/highlight-underlay.svelte";
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

  const DEFAULT_SIZE_UP_AMOUNT = HIGHLIGHT_DEFAULTS.sizeUpAmount;
  const DEFAULT_DIM_MS = HIGHLIGHT_DEFAULTS.dimTransition;
  const DEFAULT_SIZE_MS = HIGHLIGHT_DEFAULTS.sizeUpTransition;

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

  /**
   * AnimatePresence-style exit bookkeeping. Armed by the dim/clone outros
   * AND by every underlay restore (the restore's inline transition must be
   * wiped before a queued slide morph may start — see the restore contract
   * in highlight-underlay); released as each completes. When the counter
   * drains to zero, `onExitComplete` fires once (createHighlightNav's
   * finishPending is idempotent, and its fail-safe timer covers the
   * "nothing animated" case).
   */
  let pendingExits = 0;

  function handleOutroStart() {
    pendingExits += 1;
  }

  function handleOutroEnd() {
    pendingExits = Math.max(0, pendingExits - 1);
    if (pendingExits === 0) onExitComplete?.();
  }

  // Fade the original text chunk under the clone (under-fade to 0).
  // Gated by `shown` so originals fade back in even though `visual` is
  // retained (see note above). Restores arm the exit counter above so a
  // slide morph queued behind the outro only starts once the originals
  // are fully visible and pristine again.
  createHighlightUnderlay({
    codeContainer: () => codeContainer(),
    measurement: () => (shown ? (visual?.measurement ?? null) : null),
    dimMs: () => visual?.dimMs ?? dimMs,
    onRestoreStart: handleOutroStart,
    onRestoreEnd: handleOutroEnd,
  });
</script>

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
