<script lang="ts">
  /**
   * One fanned-out project card inside StackSpread.
   *
   * Two-layer animation:
   *  - OUTER: a critically-damped Spring drives left / top / rotate
   *    (the card's position in the fan). Smooth, no bounce.
   *  - INNER: CSS keyframes drive translateY / scale / opacity
   *    (the pop-from-below entrance with an explicit bounce).
   *
   * Close reverses both: the spring returns position to the deck origin
   * while a CSS exit animation sinks + fades the card.
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
   * Position spring — critically damped.
   * Smooth glide to the fan slot, with bounce delegated entirely to the
   * CSS keyframes on the inner layer so it stays visible and deterministic.
   */
  const POSITION_SPRING = { stiffness: 100, damping: 20 };

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

  const targetLeft = $derived(fanCenterX - PROJECT_CARD_WIDTH / 2 + fan.x);
  const targetTop = $derived(fanCenterY - PROJECT_CARD_HEIGHT / 2 + fan.y);

  const session = $derived(projectDnd.session);
  const isDragging = $derived(
    session?.payload.kind === "fan-item" &&
      session.payload.project.id === project.id &&
      session.active,
  );

  /**
   * Wider stagger: center fires first, neighbors follow with a deliberate
   * cascade.
   */
  const delayMs = $derived(Math.abs(index - (total - 1) / 2) * 80);

  /**
   * Position spring — drives ONLY left / top / rotate.
   * Starts at the deck origin; the effect retargets it to the fan slot.
   */
  const pos = new Spring(
    untrack(() => ({
      left: originLeft,
      top: originTop,
      rotate: 0,
    })),
    POSITION_SPRING,
  );

  let timer: number | undefined;

  $effect(() => {
    const target = isClosing
      ? { left: originLeft, top: originTop, rotate: 0 }
      : { left: targetLeft, top: targetTop, rotate: fan.rotate };

    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      void pos.set(target);
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

<!--
  OUTER: position layer.
  Spring drives left/top/rotate.
-->
<div
  bind:this={itemEl}
  onpointerdown={onPointerDown}
  role="presentation"
  class="absolute touch-none"
  style="
    width: {PROJECT_CARD_WIDTH}px;
    z-index: {isDragging ? 60 : 30 + index};
    left: {pos.current.left}px;
    top: {pos.current.top}px;
    transform: rotate({pos.current.rotate}deg);
  "
>
  <!--
    INNER: pop layer.
    CSS keyframes handle translateY + scale + opacity.
    The open animation is staggered; the close animation starts immediately.
  -->
  <div
    class="card-pop"
    class:card-pop--closing={isClosing}
    class:card-pop--dragging={isDragging}
    style="animation-delay: {isClosing ? 0 : delayMs}ms;"
  >
    <div class="rounded-xl bg-background shadow-2xl ring-1 ring-border/80">
      <ProjectCard {project} />
    </div>
  </div>
</div>

<style>
  .card-pop {
    transform-origin: center 180%;
    will-change: transform, opacity;
  }

  .card-pop:not(.card-pop--closing) {
    animation: card-pop-in 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .card-pop--closing {
    animation: card-pop-out 340ms cubic-bezier(0.55, 0, 1, 0.45) both;
  }

  .card-pop--dragging {
    opacity: 0.3 !important;
  }

  @keyframes card-pop-in {
    0% {
      opacity: 0.3;
      transform: translateY(70px) scale(0.82);
    }

    40% {
      opacity: 0.85;
      transform: translateY(-14px) scale(1.04);
    }

    62% {
      opacity: 0.96;
      transform: translateY(6px) scale(0.985);
    }

    80% {
      opacity: 0.99;
      transform: translateY(-3px) scale(1.005);
    }

    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes card-pop-out {
    0% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }

    100% {
      opacity: 0;
      transform: translateY(45px) scale(0.88);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .card-pop:not(.card-pop--closing),
    .card-pop--closing {
      animation-duration: 1ms;
    }
  }
</style>
