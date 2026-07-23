<script lang="ts">
  import type { Snippet } from "svelte";
  import type { IconComponent } from "@/lib/icon-types";
  import { cn } from "@/lib/utils";

  let {
    icon: Icon,
    title,
    description,
    compact = false,
    class: className,
    children,
  }: {
    icon: IconComponent;
    title: string;
    description?: string;
    children?: Snippet;
    compact?: boolean;
    class?: string;
  } = $props();
</script>

<div
  class={cn(
    "flex flex-col items-center justify-center text-center",
    compact ? "py-10" : "rounded-2xl border-2 border-dashed border-muted bg-muted/20 py-24",
    className,
  )}
>
  <div
    class={cn(
      "mb-4 flex items-center justify-center rounded-full bg-muted",
      compact ? "h-10 w-10" : "h-16 w-16",
    )}
  >
    <Icon class={cn("text-muted-foreground", compact ? "h-5 w-5" : "h-8 w-8")} />
  </div>
  <h2 class={cn("mb-2 font-semibold", compact ? "text-sm" : "text-xl")}>{title}</h2>
  {#if description}
    <p class={cn("max-w-sm text-muted-foreground", compact ? "mb-3 text-xs" : "mb-5")}>
      {description}
    </p>
  {/if}
  {#if children}
    <div class="flex gap-2">{@render children()}</div>
  {/if}
</div>
