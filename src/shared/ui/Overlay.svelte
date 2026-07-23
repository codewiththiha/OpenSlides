<script lang="ts" module>
  export const Z_INDEX = {
    editorExpanded: 90,
    drawerBackdrop: 40,
    drawer: 50,
    contextMenu: 100,
    presentation: 100,
    presentationControls: 110,
    presentationProgress: 120,
    hoverPreview: 200,
    command: 200,
    shortcuts: 210,
  } as const;
</script>

<script lang="ts">
  import { escapeKey } from "$lib/actions/escape-key";
  import type { Snippet } from "svelte";
  import { fade } from "svelte/transition";
  import { cn } from "$lib/lib/utils";

  let {
    onClose,
    z = Z_INDEX.command,
    placement = "center",
    closeOnEsc = false,
    class: className,
    children,
  }: {
    onClose: () => void;
    z?: number;
    placement?: "center" | "top";
    closeOnEsc?: boolean;
    class?: string;
    children?: Snippet;
  } = $props();
</script>

<div
  use:escapeKey={{
    onEscape: () => {
      if (closeOnEsc) onClose();
    },
  }}
  class={cn(
    "fixed inset-0 flex bg-black/50 backdrop-blur-sm",
    placement === "center"
      ? "items-center justify-center p-4"
      : "items-start justify-center pt-[15vh]",
  )}
  style="z-index: {z}"
  transition:fade={{ duration: 120 }}
>
  <!-- Backdrop dismiss is a pointer-only affordance (dialogs close via
       Esc / their own buttons), so it carries presentation semantics. -->
  <div class="absolute inset-0" onclick={onClose} role="presentation"></div>
  <div class={cn("relative", className)}>
    {@render children?.()}
  </div>
</div>
