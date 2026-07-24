<script lang="ts">
  /**
   * One fanned-out project card inside StackSpread.
   *
   * The card springs from the source deck rect into its fan slot with a
   * slower, underdamped motion: starts lower + smaller + transparent,
   * then lifts, fades, and bounces into place. A wider per-index delay
   * creates a more deliberate cascade across the fan.
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

  const SPRING_OPTS = { stiffness: 180, damping: 14 };

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

  const delayMs = $derived(Math.abs(index - (total - 1) / 2) * 70);

  const originState = $derived({
    left: originLeft,
    top: originTop,
    scale: 0.6,
    opacity: 0,
    rotate: 0,
    offsetY: 60,
  });

  // The spring only starts at the deck rect — the effect below drives it
  // into the fan target (and back on close) via pos.set(). untrack() marks
  // the initial read of the deriveds as deliberate.
  const pos = new Spring(
    untrack(() => ({
      left: originLeft,
      top: originTop,
      scale: 0.6,
      opacity: 0,
      rotate: 0,
      offsetY: 60,
    })),
    SPRING_OPTS,
  );

  let timer: number | undefined;

  $effect(() => {
    const target = isClosing
      ? originState
      : {
          left: targetLeft,
          top: targetTop,
          scale: 1,
          opacity: isDragging ? 0.3 : 1,
          rotate: fan.rotate,
          offsetY: 0,
        };
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

<div
  bind:this={itemEl}
  onpointerdown={onPointerDown}
  role="presentation"
  class="absolute touch-none"
  style="
    width: {PROJECT_CARD_WIDTH}px;
    transform-origin: center 180%;
    z-index: {isDragging ? 60 : 30 + index};
    left: {pos.current.left}px;
    top: {pos.current.top}px;
    transform:
      translateY({pos.current.offsetY}px)
      scale({pos.current.scale})
      rotate({pos.current.rotate}deg);
    opacity: {pos.current.opacity};
  "
>
  <div class="rounded-xl bg-background shadow-2xl ring-1 ring-border/80">
    <ProjectCard {project} />
  </div>
</div>
