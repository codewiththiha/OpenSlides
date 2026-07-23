<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "$lib/lib/utils";

  let {
    title,
    description,
    borderTop = false,
    class: className,
    children,
  }: {
    title: string;
    description?: string;
    class?: string;
    /** Adds a top border + padding to separate this section from the one above */
    borderTop?: boolean;
    children?: Snippet;
  } = $props();
</script>

<section class={cn("space-y-3", borderTop && "border-t pt-4", className)}>
  <h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
    {title}
  </h3>
  {#if description}
    <p class="text-[11px] text-muted-foreground">{description}</p>
  {/if}
  {@render children?.()}
</section>
