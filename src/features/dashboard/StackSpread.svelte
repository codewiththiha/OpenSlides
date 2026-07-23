<script lang="ts">
  /**
   * The deck fan overlay — portal'd to body like the React createPortal.
   * framer-motion springs (stiffness/damping are per-config below), the
   * 260ms close-then-unmount choreography, and dnd-kit fan-item dragging
   * are preserved via svelte/motion + the shared pointer-drag manager.
   */
  import { untrack } from "svelte";
  import { Spring, Tween } from "svelte/motion";
  import { Ungroup, X } from "@lucide/svelte";
  import { type ProjectSummary } from "$lib/types";
  import { type GroupChunk } from "$lib/lib/grouping";
  import StackSpreadItem from "./StackSpreadItem.svelte";
  import { Z_INDEX } from "$lib/ui/Overlay.svelte";
  import { portal } from "$lib/actions/portal";
  import { EASE_DIM } from "@/features/highlights/easings";

  let {
    chunk,
    deckElement,
    onClose,
    isRenaming,
    renameValue,
    onRenameValueChange,
    onCommitRename,
    onCancelRename,
    onStartRename,
    onOpen,
    onDuplicate,
    onExport,
    onDelete,
    duplicateBusy,
    commitBusy,
    onUngroup,
  }: {
    chunk: GroupChunk<ProjectSummary>;
    deckElement: HTMLElement | null;
    onClose: () => void;
    isRenaming: (id: string) => boolean;
    renameValue: string;
    onRenameValueChange: (value: string) => void;
    onCommitRename: () => void;
    onCancelRename: () => void;
    onStartRename: (id: string, name: string) => void;
    onOpen: (id: string) => void;
    onDuplicate: (id: string) => void;
    onExport: (id: string) => void;
    onDelete: (id: string, name: string) => void;
    duplicateBusy: boolean;
    commitBusy: boolean;
    onUngroup: (ids: string[]) => void;
  } = $props();

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
    }, 260);
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

  const projects = $derived(chunk.items);
  const total = $derived(projects.length);

  const fanCenterX = $derived(
    Math.max(
      240,
      Math.min(
        window.innerWidth - 240,
        (currentDeckRect?.left ?? window.innerWidth / 2) + (currentDeckRect?.width ?? 220) / 2,
      ),
    ),
  );
  const fanCenterY = $derived(
    Math.max(
      180,
      Math.min(
        window.innerHeight - 200,
        (currentDeckRect?.top ?? window.innerHeight / 2) + (currentDeckRect?.height ?? 150) / 2,
      ),
    ),
  );

  const cardWidth = 220;
  const cardHeight = 180;
  const spreadWidth = $derived(cardWidth + (total - 1) * 85 + 80);
  const spreadHeight = $derived(cardHeight + Math.abs((total - 1) / 2) * 12 + 80);

  /* Motion values (framer-motion spring/tween equivalents) */
  const backdrop = new Tween(0, { duration: 240, easing: EASE_DIM });
  const wrap = new Spring({ opacity: 0, scale: 0.85 }, { stiffness: 300, damping: 25 });
  const controls = new Spring({ opacity: 0, scale: 0.5 }, { stiffness: 350, damping: 22 });

  $effect(() => {
    void backdrop.set(isClosing ? 0 : 1, { duration: 240, easing: EASE_DIM });
  });

  $effect(() => {
    void wrap.set(isClosing ? { opacity: 0, scale: 0.85 } : { opacity: 1, scale: 1 });
  });

  $effect(() => {
    const closed = isClosing;
    const timer = window.setTimeout(
      () => {
        void controls.set(closed ? { opacity: 0, scale: 0.5 } : { opacity: 1, scale: 1 });
      },
      closed ? 0 : 150,
    );
    return () => window.clearTimeout(timer);
  });
</script>

<div
  use:portal
  class="fixed inset-0 select-none overflow-hidden"
  style="z-index: {Z_INDEX.hoverPreview || 200};"
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
    style="left: {fanCenterX - spreadWidth / 2}px; top: {fanCenterY - spreadHeight / 2}px; width: {spreadWidth}px; height: {spreadHeight}px; opacity: {wrap
      .current.opacity}; transform: scale({wrap.current.scale});"
  ></div>

  <!-- Mini floating controls — top-right of the highlight wrapper -->
  <div
    class="absolute z-50 flex items-center gap-1.5"
    style="left: {fanCenterX + spreadWidth / 2 - 4}px; top: {fanCenterY -
      spreadHeight / 2 -
      4}px; opacity: {controls.current.opacity}; transform: scale({controls.current.scale});"
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
          isRenaming={isRenaming(project.id)}
          {renameValue}
          {onRenameValueChange}
          {onCommitRename}
          {onCancelRename}
          {onStartRename}
          onOpen={(id) => {
            triggerClose();
            onOpen(id);
          }}
          {onDuplicate}
          {onExport}
          {onDelete}
          {duplicateBusy}
          {commitBusy}
        />
      {/each}
    </div>
  </div>
</div>
