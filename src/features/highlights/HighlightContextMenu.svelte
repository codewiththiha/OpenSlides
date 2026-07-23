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

  let {
    visible,
    position,
    onAddHighlight,
    onClose,
  }: {
    /** Whether the menu is visible */
    visible: boolean;
    /** Position where the menu should appear */
    position: { x: number; y: number };
    /** Callback when "Add Highlight" is clicked */
    onAddHighlight: () => void;
    /** Callback to close the menu */
    onClose: () => void;
  } = $props();



</script>

{#if visible}
  <div
    use:clickOutside={{ onOutside: onClose, delayMs: 50 }}
    use:escapeKey={{ onEscape: onClose, delayMs: 50 }}
    class="fixed min-w-[180px] rounded-lg border border-border/80 bg-card/95 py-1 shadow-xl backdrop-blur-md"
    role="menu"
    aria-label="Highlight actions"
    style="left: {position.x}px; top: {position.y}px; z-index: {Z_INDEX.contextMenu};"
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
