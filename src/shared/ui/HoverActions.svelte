<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "$lib/lib/utils";

  let { class: className, children }: { class?: string; children?: Snippet } = $props();
</script>

<div
  class={cn(
    "hover-actions flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100",
    className,
  )}
>
  {@render children?.()}
</div>
