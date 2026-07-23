<script lang="ts">
  /**
   * Custom context menu that appears when highlight mode is enabled
   * and the user right-clicks with text selected in the code editor.
   */
  import { Highlighter as HighlightIcon, X } from "@lucide/svelte";
  import { Z_INDEX } from "./ui/Overlay.svelte";
  import { EASE_DIM } from "./highlights/easings";

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

  let menuEl = $state<HTMLDivElement | null>(null);

  function pop(
    _node: Element,
    { duration = 150, easing = EASE_DIM }: { duration?: number; easing?: (t: number) => number } = {},
  ) {
    return {
      duration,
      easing,
      css: (t: number) =>
        `opacity: ${t}; transform: scale(${0.95 + 0.05 * t}) translateY(${-4 * (1 - t)}px);`,
    };
  }

  $effect(() => {
    if (!visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuEl && !menuEl.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    // Delay adding listeners to avoid the right-click itself closing the menu
    const t = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }, 50);

    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  });
</script>

{#if visible}
  <div
    bind:this={menuEl}
    class="fixed min-w-[180px] rounded-lg border border-border/80 bg-card/95 py-1 shadow-xl backdrop-blur-md"
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
