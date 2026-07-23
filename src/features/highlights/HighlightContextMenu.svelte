<script lang="ts">
  /**
   * Custom context menu that appears when highlight mode is enabled
   * and the user right-clicks with text selected in the code editor.
   */
  import { clickOutside } from "$lib/actions/click-outside";
  import { escapeKey } from "$lib/actions/escape-key";
  import { Highlighter as HighlightIcon, X } from "@lucide/svelte";
  import { Z_INDEX } from "$lib/ui/Overlay.svelte";
  import { pop } from "$lib/ui/transitions/pop";
  import { clampMenuPosition } from "$lib/lib/menu-position";

  let {
    visible,
    position,
    onAddHighlight,
    onClose,
  }: {
    /** Whether the menu is visible */
    visible: boolean;
    /** Pointer point (client coordinates) */
    position: { x: number; y: number };
    /** Callback when "Add Highlight" is clicked */
    onAddHighlight: () => void;
    /** Callback to close the menu */
    onClose: () => void;
  } = $props();

  let menuEl = $state<HTMLDivElement | null>(null);
  let resolved = $state({ x: -9999, y: -9999 });
  let positioned = $state(false);

  // Measure-then-show before paint (same as SlideContextMenu): keeps the
  // menu inside the viewport without a flash at the raw click point.
  $effect(() => {
    if (!visible || !menuEl) return;
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

{#if visible}
  <div
    bind:this={menuEl}
    use:clickOutside={{ onOutside: onClose, delayMs: 50 }}
    use:escapeKey={{ onEscape: onClose, delayMs: 50 }}
    class="fixed min-w-[180px] rounded-lg border border-border/80 bg-card/95 py-1 shadow-xl backdrop-blur-md"
    role="menu"
    aria-label="Highlight actions"
    style="left: {resolved.x}px; top: {resolved.y}px; z-index: {Z_INDEX.contextMenu}; opacity: {positioned
      ? 1
      : 0};"
    transition:pop={{}}
  >
    <button
      type="button"
      class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted/60"
      onclick={() => {
        onAddHighlight();
        onClose();
      }}
    >
      <HighlightIcon class="h-3.5 w-3.5 text-primary" />
      <span>Add Highlight</span>
    </button>
    <button
      type="button"
      class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/60"
      onclick={onClose}
    >
      <X class="h-3.5 w-3.5" />
      <span>Cancel</span>
    </button>
  </div>
{/if}
