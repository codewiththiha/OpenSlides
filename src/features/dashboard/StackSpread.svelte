<script lang="ts">
  /**
   * The deck fan overlay — portal'd to body. The fan cards own their
   * bounce/fade via CSS keyframes; this shell animates the backdrop,
   * highlight ring, and control cluster with slower supporting motion and
   * a 480ms close-then-unmount choreography.
   */
  import { untrack } from "svelte";
  import { Spring, Tween } from "svelte/motion";
  import { Ungroup, X } from "@lucide/svelte";
  import { type ProjectSummary } from "$lib/types";
  import { type GroupChunk } from "$lib/lib/grouping";
  import StackSpreadItem from "./StackSpreadItem.svelte";
  import { Z_INDEX } from "$lib/ui/Overlay.svelte";
  import { portal } from "$lib/actions/portal";
  import { EASE_DIM } from "$lib/lib/easings";
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

  // Opened from the fan, a project must close the transient overlay first,
  // so this scope wraps open() while forwarding the rest untouched.
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
  // Initial anchor only — re-measured in triggerClose() before every close.
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
    closeTimer = window.setTimeout(() => {
      onClose();
    }, 550);
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

  // Viewport size as state (§10.2): fan centering must react to window
  // resizes while the spread is open — reading window.innerWidth inside a
  // $derived is not tracked.
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

  /* Motion values */
  const backdrop = new Tween(0, { duration: 420, easing: EASE_DIM });
  const wrap = new Spring(
    { opacity: 0, scale: 0.85 },
    { stiffness: 160, damping: 16 },
  );
  const controls = new Spring(
    { opacity: 0, scale: 0.5 },
    { stiffness: 180, damping: 15 },
  );

  $effect(() => {
    void backdrop.set(isClosing ? 0 : 1, { duration: 420, easing: EASE_DIM });
  });

  $effect(() => {
    void wrap.set(
      isClosing ? { opacity: 0, scale: 0.85 } : { opacity: 1, scale: 1 },
    );
  });

  $effect(() => {
    const closed = isClosing;
    const timer = window.setTimeout(
      () => {
        void controls.set(
          closed ? { opacity: 0, scale: 0.5 } : { opacity: 1, scale: 1 },
        );
      },
      closed ? 0 : 450,
    );
    return () => window.clearTimeout(timer);
  });
</script>

<div
  use:portal
  class="fixed inset-0 overflow-hidden select-none"
  style="z-index: {Z_INDEX.hoverPreview};"
>
  <!-- Transparent catcher backdrop -->
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
    style="opacity: {backdrop.current};"
    onclick={triggerClose}
  ></div>

  <!-- Highlight wrapper around the spread -->
  <div
    class="absolute rounded-2xl border-2 border-primary/25 bg-primary/[0.04] shadow-[0_0_40px_rgba(0,0,0,0.3)]"
    style="left: {fanCenterX - spreadWidth / 2}px; top: {fanCenterY -
      spreadHeight /
        2}px; width: {spreadWidth}px; height: {spreadHeight}px; opacity: {wrap
      .current.opacity}; transform: scale({wrap.current.scale});"
  ></div>

  <!-- Mini floating controls — top-right of the highlight wrapper -->
  <div
    class="absolute z-50 flex items-center gap-1.5"
    style="left: {fanCenterX + spreadWidth / 2 - 4}px; top: {fanCenterY -
      spreadHeight / 2 -
      4}px; opacity: {controls.current.opacity}; transform: scale({controls
      .current.scale});"
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
  </div>

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
