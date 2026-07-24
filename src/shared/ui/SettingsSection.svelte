<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "$lib/lib/utils";

  let {
    title,
    description,
    badge,
    class: className,
    children,
  }: {
    title: string;
    description?: string;
    badge?: string;
    class?: string;
    children?: Snippet;
  } = $props();
</script>

<section class={cn("space-y-2", className)}>
  <div class="flex min-w-0 items-center gap-2">
    <h3
      class="truncate text-[10px] font-semibold tracking-wide text-muted-foreground uppercase"
    >
      {title}
    </h3>
    {#if badge}
      <span
        class="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] leading-none font-semibold tracking-wide text-primary uppercase"
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

  <div class="space-y-3 rounded-xl bg-muted/30 p-4">
    {@render children?.()}
  </div>
</section>
