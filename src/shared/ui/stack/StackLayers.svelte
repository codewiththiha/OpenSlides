<script lang="ts">
  /**
   * StackLayers — ghost cards behind the top item of a stack. Pure CSS
   * transforms, no motion library needed.
   */
  import { cn } from "$lib/lib/utils";

  let {
    count = 1,
    hovered = false,
    class: className,
    variant = "project",
  }: {
    count?: number;
    hovered?: boolean;
    class?: string;
    variant?: "project" | "slide";
  } = $props();

  const isSlide = $derived(variant === "slide");
</script>

{#if count > 1}
  <div class={cn("pointer-events-none absolute inset-0 -z-10", className)}>
    <!-- Second ghost layer (bottom of pile, visible when count >= 3) -->
    {#if count >= 3}
      <div
        class={cn(
          "absolute inset-0 rounded-xl border border-border/80 bg-card shadow-sm transition-all duration-300 ease-out",
          isSlide
            ? hovered
              ? "rotate-[-4deg] -translate-x-2.5 translate-y-1 scale-95"
              : "rotate-[-2deg] -translate-x-1.5 translate-y-0.5 scale-[0.98]"
            : hovered
              ? "rotate-[-5deg] -translate-x-3.5 translate-y-1.5 scale-95 shadow-md"
              : "rotate-[-3deg] -translate-x-2 translate-y-1 scale-[0.98]",
        )}
      ></div>
    {/if}
    <!-- First ghost layer (middle of pile, visible when count >= 2) -->
    <div
      class={cn(
        "absolute inset-0 rounded-xl border border-border/90 bg-card shadow-sm transition-all duration-300 ease-out",
        isSlide
          ? hovered
            ? "rotate-[4deg] translate-x-2.5 translate-y-1 scale-95"
            : "rotate-[2deg] translate-x-1.5 translate-y-0.5 scale-[0.98]"
          : hovered
            ? "rotate-[5deg] translate-x-3.5 translate-y-1.5 scale-95 shadow-md"
            : "rotate-[3deg] translate-x-2 translate-y-1 scale-[0.98]",
      )}
    ></div>
  </div>
{/if}
