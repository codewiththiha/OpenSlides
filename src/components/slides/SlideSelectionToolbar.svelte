<script lang="ts">
  /** Persistent batch controls for selected slide cards. */
  import type { IconComponent } from "@/lib/icon-types";
  import { ArrowLeftToLine, ArrowRightToLine, Layers3, Trash2, X } from "lucide-svelte";
  import { Z_INDEX } from "../ui/Overlay.svelte";
  import { EASE_DIM } from "../highlights/easings";
  import { cn } from "@/lib/utils";

  let {
    open,
    selectionCount,
    totalSlides,
    onMoveToStart,
    onMoveToEnd,
    onGroup,
    onDelete,
    onCancel,
  }: {
    open: boolean;
    selectionCount: number;
    totalSlides: number;
    onMoveToStart: () => void;
    onMoveToEnd: () => void;
    onGroup: () => void;
    onDelete: () => void;
    onCancel: () => void;
  } = $props();

  function rise(
    _node: Element,
    { duration = 160, easing = EASE_DIM }: { duration?: number; easing?: (t: number) => number } = {},
  ) {
    return {
      duration,
      easing,
      css: (t: number) =>
        `opacity: ${t}; transform: translateY(${12 * (1 - t)}px) scale(${0.96 + 0.04 * t});`,
    };
  }
</script>

{#snippet bubbleButton(
  label: string,
  Icon: IconComponent,
  onclick: () => void,
  disabled = false,
  destructive = false,
)}
  <button
    type="button"
    {disabled}
    {onclick}
    title={label}
    aria-label={label}
    class={cn(
      "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
      destructive
        ? "text-destructive hover:bg-destructive/12"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
      "disabled:pointer-events-none disabled:opacity-35",
    )}
  >
    <Icon class="h-3.5 w-3.5" />
  </button>
{/snippet}

{#if open}
  <div
    class="fixed bottom-[18px] right-[18px] flex items-center gap-1 rounded-full border border-border/80 bg-card/95 p-1.5 shadow-xl backdrop-blur-md"
    style="z-index: {Z_INDEX.contextMenu};"
    transition:rise={{}}
    role="toolbar"
    aria-label="Selected slide actions"
  >
    <span
      class="min-w-8 px-1 text-center text-[11px] font-semibold tabular-nums text-foreground"
      title="{selectionCount} slides selected"
    >
      {selectionCount}
    </span>
    <span class="h-5 w-px bg-border/70"></span>
    {@render bubbleButton("Move selected to start", ArrowLeftToLine, onMoveToStart)}
    {@render bubbleButton("Move selected to end", ArrowRightToLine, onMoveToEnd)}
    {@render bubbleButton("Group selected", Layers3, onGroup, selectionCount < 2)}
    {@render bubbleButton(
      "Delete selected",
      Trash2,
      onDelete,
      selectionCount === 0 || selectionCount === totalSlides,
      true,
    )}
    <span class="h-5 w-px bg-border/70"></span>
    {@render bubbleButton("Cancel selection (Esc)", X, onCancel)}
  </div>
{/if}
