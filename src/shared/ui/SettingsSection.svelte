<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "$lib/lib/utils";

  let {
    title,
    description,
    badge,
    borderTop = false,
    onReset,
    class: className,
    children,
  }: {
    title: string;
    description?: string;
    badge?: string;
    class?: string;
    /** Adds a top border + padding to separate this section from the one above */
    borderTop?: boolean;
    /** Optional per-section reset action, rendered in the sticky title row. */
    onReset?: () => void;
    children?: Snippet;
  } = $props();
</script>

<section class={cn("space-y-2", borderTop && "border-t pt-4", className)}>
  <div class="sticky top-0 z-10 -mx-4 bg-card/95 px-4 py-2 backdrop-blur-sm">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0 space-y-1">
        <div class="flex min-w-0 items-center gap-2">
          <h3
            class="truncate text-xs font-semibold tracking-wide text-muted-foreground uppercase"
          >
            {title}
          </h3>
          {#if badge}
            <span
              class="rounded-full border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[9px] leading-none font-semibold tracking-wide text-primary uppercase"
            >
              {badge}
            </span>
          {/if}
        </div>
        {#if description}
          <p class="text-[11px] leading-snug text-muted-foreground">
            {description}
          </p>
        {/if}
      </div>

      {#if onReset}
        <button
          type="button"
          class="shrink-0 rounded px-1.5 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none"
          onclick={onReset}
          aria-label="Reset {title} settings"
        >
          Reset
        </button>
      {/if}
    </div>
  </div>

  <div class="space-y-3 rounded-lg border border-border/40 bg-muted/10 p-3">
    {@render children?.()}
  </div>
</section>
