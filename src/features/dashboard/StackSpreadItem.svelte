<script lang="ts">
  /**
   * One fanned-out project card inside StackSpread.
   *
   * Uses @humanspeak/svelte-motion (Framer Motion API for Svelte 5).
   * A single spring drives left / top / scale / opacity / rotate with a
   * per-card stagger delay, matching the original React/framer-motion fan.
   *
   * BUG FIX: `initial` is captured ONCE via untrack() so it never
   * re-applies mid-animation. A base `opacity: 0` in the style prevents
   * any single-frame flash at (0,0) during mount/unmount races.
   */
  import { untrack } from "svelte";
  import { motion } from "@humanspeak/svelte-motion";
  import { type ProjectSummary } from "$lib/types";
  import { computeFanLayout } from "$lib/lib/stacking";
  import ProjectCard from "./ProjectCard.svelte";
  import {
    beginProjectDrag,
    projectDnd,
  } from "@/features/dashboard/project-dnd.svelte";
  import { PROJECT_CARD_WIDTH, PROJECT_CARD_HEIGHT } from "./layout";

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

  const session = $derived(projectDnd.session);
  const isDragging = $derived(
    session?.payload.kind === "fan-item" &&
      session.payload.project.id === project.id &&
      session.active,
  );

  /** Center-out stagger — matches React's 0.05s per step. */
  const delaySeconds = $derived(Math.abs(index - (total - 1) / 2) * 0.05);

  // BUG FIX: Capture initial position ONCE, non-reactively.
  const initialPose = untrack(() => ({
    left: originLeft,
    top: originTop,
    scale: 0.5,
    opacity: 0,
    rotate: 0,
  }));

  const animateTarget = $derived(
    isClosing
      ? {
          left: originLeft,
          top: originTop,
          scale: 0.5,
          opacity: 0,
          rotate: 0,
        }
      : {
          left: targetLeft,
          top: targetTop,
          scale: 1,
          opacity: isDragging ? 0.3 : 1,
          rotate: fan.rotate,
        },
  );

  let itemEl = $state<HTMLElement | null>(null);

  function onPointerDown(e: PointerEvent) {
    beginProjectDrag({ kind: "fan-item", project, groupId }, e, {
      width: itemEl?.getBoundingClientRect().width ?? PROJECT_CARD_WIDTH,
      originLeft: itemEl?.getBoundingClientRect().left ?? 0,
      originTop: itemEl?.getBoundingClientRect().top ?? 0,
    });
  }
</script>

<motion.div
  bind:ref={itemEl}
  onpointerdown={onPointerDown}
  role="presentation"
  class="absolute touch-none"
  style="width: {PROJECT_CARD_WIDTH}px; transform-origin: center 180%; z-index: {isDragging
    ? 60
    : 30 + index}; opacity: 0;"
  initial={initialPose}
  animate={animateTarget}
  transition={{
    type: "spring",
    stiffness: 260,
    damping: 20,
    mass: 0.8,
    delay: delaySeconds,
  }}
>
  <div class="rounded-xl bg-background shadow-2xl ring-1 ring-border/80">
    <ProjectCard {project} />
  </div>
</motion.div>
