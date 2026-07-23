<script lang="ts">
  import { GripVertical } from "@lucide/svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import { cn } from "$lib/lib/utils";

  let {
    class: className,
    iconClassName,
    children: _children,
    ...props
  }: HTMLButtonAttributes & { class?: string; iconClassName?: string } = $props();
</script>

<button
  type="button"
  class={cn(
    "shrink-0 cursor-grab touch-none rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing disabled:pointer-events-none disabled:opacity-40",
    className,
  )}
  {...props}
>
  <GripVertical class={cn("h-3.5 w-3.5", iconClassName)} />
</button>
