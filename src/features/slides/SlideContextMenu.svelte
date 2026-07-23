<script lang="ts">
  /** Right-click menu for entering a slide-selection workflow. */
  import type { Component } from "svelte";
  import { CheckSquare, Pencil, SquareDashedMousePointer } from "@lucide/svelte";
  import { Z_INDEX } from "$lib/ui/Overlay.svelte";
  import { EASE_DIM } from "@/features/highlights/easings";

  let {
    open,
    position,
    onRename,
    onStartSelection,
    onSelectAll,
    onClose,
  }: {
    open: boolean;
    position: { x: number; y: number };
    onRename: () => void;
    onStartSelection: () => void;
    onSelectAll: () => void;
    onClose: () => void;
  } = $props();

  let menuEl = $state<HTMLDivElement | null>(null);
  let resolved = $state({ x: -9999, y: -9999 });
  let positioned = $state(false);

  function pop(
    _node: Element,
    { duration = 140, easing = EASE_DIM }: { duration?: number; easing?: (t: number) => number } = {},
  ) {
    return {
      duration,
      easing,
      css: (t: number) =>
        `opacity: ${t}; transform: scale(${0.96 + 0.04 * t}) translateY(${-4 * (1 - t)}px);`,
    };
  }

  // Measure-then-show: keeps the menu inside the viewport without a flash
  // at the raw click point (React's useLayoutEffect pass).
  $effect(() => {
    if (!open || !menuEl) return;
    void position.x;
    void position.y;
    positioned = false;
    const rect = menuEl.getBoundingClientRect();
    const gap = 8;
    const edge = 8;
    let left = position.x + gap;
    let top = position.y - rect.height - gap;
    if (left + rect.width > window.innerWidth - edge) {
      left = Math.max(edge, window.innerWidth - rect.width - edge);
    }
    if (top < edge) top = Math.min(window.innerHeight - rect.height - edge, position.y + gap);
    resolved = { x: left, y: top };
    positioned = true;
  });

  $effect(() => {
    if (!open) return;
    const dismiss = (event: MouseEvent) => {
      if (menuEl && !menuEl.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", dismiss);
      document.addEventListener("keydown", onKeyDown);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", dismiss);
      document.removeEventListener("keydown", onKeyDown);
    };
  });
</script>

{#snippet menuItem(Icon: Component<{ class?: string }>, label: string, shortcut: string | undefined, onclick: () => void)}
  <button
    type="button"
    class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted/70"
    {onclick}
  >
    <Icon class="h-3.5 w-3.5 shrink-0" />
    <span class="flex-1">{label}</span>
    {#if shortcut}<span class="text-[10px] text-muted-foreground">{shortcut}</span>{/if}
  </button>
{/snippet}

{#if open}
  <div
    bind:this={menuEl}
    class="fixed min-w-[210px] overflow-hidden rounded-lg border border-border/80 bg-card/95 py-1 shadow-xl backdrop-blur-md"
    style="left: {resolved.x}px; top: {resolved.y}px; visibility: {positioned
      ? 'visible'
      : 'hidden'}; z-index: {Z_INDEX.contextMenu};"
    transition:pop={{}}
    role="menu"
    aria-label="Slide actions"
  >
    {@render menuItem(Pencil, "Rename", "F2", onRename)}
    {@render menuItem(CheckSquare, "Select all slides", undefined, onSelectAll)}
    {@render menuItem(SquareDashedMousePointer, "Select multiple", undefined, onStartSelection)}
  </div>
{/if}
