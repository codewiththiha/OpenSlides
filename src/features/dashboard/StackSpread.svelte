<script lang="ts">
  /**
   * The deck fan overlay — portal'd to body.
   *
   * Uses @humanspeak/svelte-motion for backdrop, highlight ring, and
   * control cluster. Fan cards (StackSpreadItem) own their own spring.
   * Close choreography: 480ms for all springs to settle, then unmount.
   */
  import { untrack } from "svelte";
  import { motion } from "@humanspeak/svelte-motion";
  import { Ungroup, X } from "@lucide/svelte";
  import { type ProjectSummary } from "$lib/types";
  import { type GroupChunk } from "$lib/lib/grouping";
  import StackSpreadItem from "./StackSpreadItem.svelte";
  import { Z_INDEX } from "$lib/ui/Overlay.svelte";
  import { portal } from "$lib/actions/portal";
  import { stackFanCenter, stackFanSize } from "./stack-fan-layout";
  import {
    consumeProjectCardActions,
    provideProjectCardActions,
  } from "./project-card-actions.svelte";

  let {
    chunk,
    deckElement,
    onClose,
    onUngroup,
  }: {
    chunk: GroupChunk<ProjectSummary>;
    deckElement: HTMLElement | null;
    onClose: () => void;
    onUngroup: (ids: string[]) => void;
  } = $props();

  const baseCardActions = consumeProjectCardActions();

  provideProjectCardActions({
    get renamingId() {
      return baseCardActions.renamingId;
    },
    get renameValue() {
      return baseCardActions.renameValue;
    },
    get duplicateBusy() {
      return baseCardActions.duplicateBusy;
    },
    get commitBusy() {
      return baseCardActions.commitBusy;
    },
    setRenameValue: baseCardActions.setRenameValue,
    commitRename: baseCardActions.commitRename,
    cancelRename: baseCardActions.cancelRename,
    startRename: baseCardActions.startRename,
    open: (id) => {
      triggerClose();
      baseCardActions.open(id);
    },
    duplicate: baseCardActions.duplicate,
    exportProject: baseCardActions.exportProject,
    remove: baseCardActions.remove,
  });

  let isClosing = $state(false);
  let currentDeckRect = $state<DOMRect | null>(
    untrack(() => deckElement?.getBoundingClientRect() ?? null),
  );
  let closeTimer: number | undefined;

  function triggerClose() {
    if (isClosing) return;
    if (deckElement) {
      currentDeckRect = deckElement.getBoundingClientRect();
    }
    isClosing = true;
    // Enough for the slowest spring (controls, delay 0.15 + settle).
    closeTimer = window.setTimeout(() => onClose(), 480);
  }

  $effect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        triggerClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.clearTimeout(closeTimer);
    };
  });

  // Viewport size as state — fan centering reacts to resize.
  let viewportW = $state(0);
  let viewportH = $state(0);

  $effect(() => {
    const measure = () => {
      viewportW = window.innerWidth;
      viewportH = window.innerHeight;
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  });

  const projects = $derived(chunk.items);
  const total = $derived(projects.length);

  const fanCenter = $derived(
    stackFanCenter({ deckRect: currentDeckRect, viewportW, viewportH }),
  );
  const fanCenterX = $derived(fanCenter.x);
  const fanCenterY = $derived(fanCenter.y);

  const fanSize = $derived(stackFanSize(total));
  const spreadWidth = $derived(fanSize.width);
  const spreadHeight = $derived(fanSize.height);
</script>

<div
  use:portal
  class="fixed inset-0 overflow-hidden select-none"
  style="z-index: {Z_INDEX.hoverPreview};"
>
  <!-- Backdrop — React: duration 0.2 -->
  <motion.div
    class="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
    initial={{ opacity: 0 }}
    animate={{ opacity: isClosing ? 0 : 1 }}
    transition={{ duration: 0.2 }}
    onclick={triggerClose}
  />

  <!-- Highlight wrapper — React: spring stiffness 300, damping 25 -->
  <motion.div
    class="absolute rounded-2xl border-2 border-primary/25 bg-primary/[0.04] shadow-[0_0_40px_rgba(0,0,0,0.3)]"
    style="left: {fanCenterX - spreadWidth / 2}px; top: {fanCenterY -
      spreadHeight / 2}px; width: {spreadWidth}px; height: {spreadHeight}px;"
    initial={{ opacity: 0, scale: 0.85 }}
    animate={isClosing ? { opacity: 0, scale: 0.85 } : { opacity: 1, scale: 1 }}
    transition={{ type: "spring", stiffness: 300, damping: 25 }}
  />

  <!-- Floating controls — React: spring stiffness 350, damping 22, delay 0.15 -->
  <motion.div
    class="absolute z-50 flex items-center gap-1.5"
    style="left: {fanCenterX + spreadWidth / 2 - 4}px; top: {fanCenterY -
      spreadHeight / 2 -
      4}px;"
    initial={{ opacity: 0, scale: 0.5 }}
    animate={isClosing ? { opacity: 0, scale: 0.5 } : { opacity: 1, scale: 1 }}
    transition={{ type: "spring", stiffness: 350, damping: 22, delay: 0.15 }}
  >
    <button
      type="button"
      title="Ungroup all"
      onclick={() => {
        triggerClose();
        onUngroup(projects.map((p) => p.id));
      }}
      class="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-lg transition-colors hover:bg-destructive/10 hover:text-destructive"
    >
      <Ungroup class="h-3.5 w-3.5" />
    </button>
    <button
      type="button"
      title="Close spread"
      onclick={triggerClose}
      class="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-lg transition-colors hover:bg-muted hover:text-foreground"
    >
      <X class="h-3.5 w-3.5" />
    </button>
  </motion.div>

  <!-- Fanned Cards -->
  <div class="pointer-events-none absolute inset-0">
    <div class="pointer-events-auto">
      {#each projects as project, index (project.id)}
        <StackSpreadItem
          {project}
          {index}
          {total}
          {fanCenterX}
          {fanCenterY}
          deckRect={currentDeckRect}
          {isClosing}
          groupId={chunk.groupId}
        />
      {/each}
    </div>
  </div>
</div>
