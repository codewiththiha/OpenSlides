<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "@/lib/utils";

  let {
    tone = "default",
    class: className,
    children,
  }: {
    tone?: "default" | "onDark";
    class?: string;
    children?: Snippet;
  } = $props();
</script>

<kbd
  class={cn(
    "inline-flex min-w-[1.5rem] items-center justify-center rounded px-1.5 py-0.5 font-mono text-[11px]",
    tone === "onDark"
      ? "bg-white/20 text-white"
      : "border border-border bg-muted text-foreground shadow-sm",
    className,
  )}
>
  {@render children?.()}
</kbd>
