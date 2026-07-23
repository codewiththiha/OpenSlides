<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import { cn } from "$lib/lib/utils";

  let {
    destructive = false,
    size = "sm",
    class: className,
    children,
    ...props
  }: HTMLButtonAttributes & {
    destructive?: boolean;
    size?: "sm" | "md";
    class?: string;
    children?: Snippet;
  } = $props();
</script>

<button
  type="button"
  class={cn(
    size === "sm" && "rounded p-0.5 text-muted-foreground",
    size === "md" &&
      "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground",
    size === "sm" && !destructive && "hover:bg-muted",
    size === "md" &&
      !destructive &&
      "hover:bg-accent hover:text-accent-foreground",
    destructive && "hover:bg-destructive/10 hover:text-destructive",
    className,
  )}
  {...props}
>
  {@render children?.()}
</button>
