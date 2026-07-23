<script lang="ts">
  import { Label } from "bits-ui";
  import type { Snippet } from "svelte";
  import { cn } from "$lib/lib/utils";

  let {
    class: className,
    children,
    ...rest
  }: {
    class?: string;
    children?: Snippet;
    for?: string;
    title?: string;
  } = $props();
</script>

<Label.Root
  class={cn(
    "text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
    className,
  )}
  {...rest}
>
  {@render children?.()}
</Label.Root>
