<script lang="ts">
  /** Right-click menu for entering a slide-selection workflow. */
  import { clickOutside } from "$lib/actions/click-outside";
  import { escapeKey } from "$lib/actions/escape-key";
  import type { Component } from "svelte";
  import { CheckSquare, Pencil, SquareDashedMousePointer } from "@lucide/svelte";
  import { Z_INDEX } from "$lib/ui/Overlay.svelte";
  import { pop } from "$lib/ui/transitions/pop";
  import { clampMenuPosition } from "$lib/lib/menu-position";

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

  // Measure-then-show before paint: keeps the menu inside the viewport
  // without a flash at the raw click point.
  $effect(() => {
    if (!open || !menuEl) return;
    void position.x;
    void position.y;
    positioned = false;
    const rect = menuEl.getBoundingClientRect();
    resolved = clampMenuPosition({
      x: position.x,
      y: position.y,
      width: rect.width,
      height: rect.height,
    });
    positioned = true;
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
    use:clickOutside={{ onOutside: onClose }}
    use:escapeKey={onClose}
    class="fixed min-w-[210px] overflow-hidden rounded-lg border border-border/80 bg-card/95 py-1 shadow-xl backdrop-blur-md"
    style="left: {resolved.x}px; top: {resolved.y}px; visibility: {positioned
      ? 'visible'
      : 'hidden'}; z-index: {Z_INDEX.contextMenu};"
    transition:pop={{ duration: 140, from: 0.96 }}
    role="menu"
    aria-label="Slide actions"
  >
    {@render menuItem(Pencil, "Rename", "F2", onRename)}
    {@render menuItem(CheckSquare, "Select all slides", undefined, onSelectAll)}
    {@render menuItem(SquareDashedMousePointer, "Select multiple", undefined, onStartSelection)}
  </div>
{/if}
