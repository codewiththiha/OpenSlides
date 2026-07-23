<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "@/lib/utils";

  let {
    class: className,
    children,
    ...rest
  }: HTMLAttributes<HTMLSpanElement> & { class?: string; children?: Snippet } = $props();
</script>

<span
  class={cn(
    "inline-flex items-center gap-1.5 rounded-md bg-black/60 px-2.5 py-1 text-xs text-white/80 backdrop-blur",
    className,
  )}
  {...rest}
>
  {@render children?.()}
</span>
