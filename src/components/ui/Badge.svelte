<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "@/lib/utils";

  interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    variant?: "muted" | "primary";
    class?: string;
    children?: Snippet;
  }

  let { variant = "muted", class: className, children, ...rest }: BadgeProps = $props();
</script>

<span
  class={cn(
    variant === "muted" &&
      "rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground/70",
    variant === "primary" &&
      "inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-[3px] text-[8px] font-semibold leading-none text-primary/70",
    className,
  )}
  {...rest}
>
  {@render children?.()}
</span>
