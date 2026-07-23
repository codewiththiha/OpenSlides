<script lang="ts">
  /** StackBadge — count bubble in the corner of a stacked card. */
  import { cn } from "@/lib/utils";

  let {
    count,
    class: className,
    title,
  }: {
    count: number;
    class?: string;
    title?: string;
  } = $props();
</script>

{#if count > 1}
  <div
    title={title || `${count} items — click to fan`}
    class={cn(
      "absolute -top-2 -right-2 z-30 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground shadow-md ring-2 ring-background transition-transform duration-200 hover:scale-105",
      className,
    )}
  >
    {count}
  </div>
{/if}
