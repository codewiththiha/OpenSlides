<script lang="ts">
  /**
   * One fanned-out project card inside StackSpread.
   *
   * Two-spring architecture:
   *  - posSpring (slow): drives left / top / rotate — the visible spread.
   *    Cards start in a light "tarot hold" (slightly pre-rotated, slightly
   *    pre-spread) and fan out gradually.
   *  - popSpring (quick): drives offsetY / scale / opacity — the vertical
   *    lift. Fast, with only a barely-there settle.
   *
   * Open uses a two-phase trigger: the pop starts immediately so cards begin
   * materializing with no dead zone, then the fan position starts after the
   * per-card stagger. Close collapses both springs together.
   */
  import { untrack } from "svelte";
  import { Spring } from "svelte/motion";
  import { type ProjectSummary } from "$lib/types";
  import { computeFanLayout } from "$lib/lib/stacking";
  import ProjectCard from "./ProjectCard.svelte";
  import {
    beginProjectDrag,
    projectDnd,
  } from "@/features/dashboard/project-dnd.svelte";
  import { PROJECT_CARD_WIDTH, PROJECT_CARD_HEIGHT } from "./layout";

  /**
   * Horizontal fan spread.
   * Slightly stiffer than before so it settles closer to the pop landing.
   */
  const SPREAD_SPRING = { stiffness: 80, damping: 14 };

  /**
   * Vertical pop + fade.
   * Underdamped enough for one subtle overshoot, but still restrained.
   */
  const POP_SPRING = { stiffness: 260, damping: 18 };

  /** Tarot-hold starting pose — cards begin barely pre-spread and angled. */
  const INITIAL_ROTATION_FRACTION = 0.15;
  const INITIAL_SPREAD_FRACTION = 0.06;

  let {
    project,
    index,
    total,
    fanCenterX,
    fanCenterY,
    deckRect,
    isClosing,
    groupId,
  }: {
    project: ProjectSummary;
    index: number;
    total: number;
    fanCenterX: number;
    fanCenterY: number;
    deckRect: DOMRect | null;
    isClosing: boolean;
    groupId?: string;
  } = $props();

  const fan = $derived(computeFanLayout(total, index));

  // Deck origin (where cards return on close)
  const originLeft = $derived(
    (deckRect?.left ?? fanCenterX - PROJECT_CARD_WIDTH / 2) +
      (deckRect?.width ?? PROJECT_CARD_WIDTH) / 2 -
      PROJECT_CARD_WIDTH / 2,
  );
  const originTop = $derived(
    (deckRect?.top ?? fanCenterY - PROJECT_CARD_HEIGHT / 2) +
      (deckRect?.height ?? PROJECT_CARD_HEIGHT) / 2 -
      PROJECT_CARD_HEIGHT / 2,
  );

  // Final fan target
  const targetLeft = $derived(fanCenterX - PROJECT_CARD_WIDTH / 2 + fan.x);
  const targetTop = $derived(fanCenterY - PROJECT_CARD_HEIGHT / 2 + fan.y);

  // Tarot-hold starting pose: slightly pre-spread and pre-rotated.
  const holdLeft = $derived(
    originLeft + (targetLeft - originLeft) * INITIAL_SPREAD_FRACTION,
  );
  const holdTop = $derived(
    originTop + (targetTop - originTop) * INITIAL_SPREAD_FRACTION,
  );
  const holdRotate = $derived(fan.rotate * INITIAL_ROTATION_FRACTION);

  const session = $derived(projectDnd.session);
  const isDragging = $derived(
    session?.payload.kind === "fan-item" &&
      session.payload.project.id === project.id &&
      session.active,
  );

  /** Tighter center-out ripple. */
  const delayMs = $derived(Math.abs(index - (total - 1) / 2) * 70);

  // Spring 1: slow position spread.
  const posSpring = new Spring(
    untrack(() => ({
      left: holdLeft,
      top: holdTop,
      rotate: holdRotate,
    })),
    SPREAD_SPRING,
  );

  // Spring 2: quick lift/pop.
  const popSpring = new Spring(
    untrack(() => ({
      offsetY: 110,
      scale: 0.6,
      opacity: 0,
    })),
    POP_SPRING,
  );

  let timer: number | undefined;

  $effect(() => {
    const posTarget = isClosing
      ? { left: originLeft, top: originTop, rotate: 0 }
      : { left: targetLeft, top: targetTop, rotate: fan.rotate };

    const popTarget = isClosing
      ? { offsetY: 60, scale: 0.7, opacity: 0 }
      : { offsetY: 0, scale: 1, opacity: isDragging ? 0.3 : 1 };

    window.clearTimeout(timer);

    if (isClosing) {
      // Close: everything collapses together, no stagger.
      void posSpring.set(posTarget);
      void popSpring.set(popTarget);
      return;
    }

    // Phase 1: pop starts immediately (no dead zone).
    void popSpring.set(popTarget);

    // Phase 2: fan position is staggered.
    timer = window.setTimeout(() => {
      void posSpring.set(posTarget);
    }, delayMs);

    return () => window.clearTimeout(timer);
  });

  let itemEl = $state<HTMLDivElement | null>(null);

  function onPointerDown(e: PointerEvent) {
    beginProjectDrag({ kind: "fan-item", project, groupId }, e, {
      width: itemEl?.getBoundingClientRect().width ?? PROJECT_CARD_WIDTH,
      originLeft: itemEl?.getBoundingClientRect().left ?? 0,
      originTop: itemEl?.getBoundingClientRect().top ?? 0,
    });
  }
</script>

<div
  bind:this={itemEl}
  onpointerdown={onPointerDown}
  role="presentation"
  class="absolute touch-none"
  style="
    width: {PROJECT_CARD_WIDTH}px;
    transform-origin: center 180%;
    z-index: {isDragging ? 60 : 30 + index};
    left: {posSpring.current.left}px;
    top: {posSpring.current.top}px;
    transform:
      translateY({popSpring.current.offsetY}px)
      scale({popSpring.current.scale})
      rotate({posSpring.current.rotate}deg);
    opacity: {popSpring.current.opacity};
    transition: opacity 80ms linear;
    will-change: transform, opacity;
  "
>
  <div
    class="rounded-xl bg-background shadow-2xl ring-1 ring-border/80"
    class:card-settle={!isClosing}
    style="animation-delay: {delayMs + 60}ms;"
  >
    <ProjectCard {project} />
  </div>
</div>

<style>
  @keyframes card-settle {
    0% {
      transform: scale(0.92);
    }

    55% {
      transform: scale(1.03);
    }

    78% {
      transform: scale(0.99);
    }

    100% {
      transform: scale(1);
    }
  }

  .card-settle {
    animation: card-settle 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }
</style>
