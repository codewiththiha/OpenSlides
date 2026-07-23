<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import { cn } from "$lib/lib/utils";

  interface InputProps extends HTMLInputAttributes {
    class?: string;
    value?: string;
    ref?: HTMLInputElement | null;
  }

  let {
    class: className,
    type = "text",
    value = $bindable(""),
    ref = $bindable(null),
    ...rest
  }: InputProps = $props();
</script>

<input
  bind:this={ref}
  {type}
  bind:value
  class={cn(
    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
    className,
  )}
  {...rest}
/>
