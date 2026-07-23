<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "@/lib/utils";
  import { themeBackground } from "@/types";

  let {
    html,
    fallback = null,
    theme,
    fontSize = 5.5,
    lineHeight = 1.35,
    class: className,
    codeClassName,
    ref = $bindable(null),
    style,
  }: {
    html: string | null;
    fallback?: Snippet | null;
    theme: string;
    fontSize?: number;
    lineHeight?: number;
    class?: string;
    codeClassName?: string;
    ref?: HTMLDivElement | null;
    style?: string;
  } = $props();
</script>

<div
  bind:this={ref}
  class={cn("relative w-full overflow-hidden", className)}
  style="background-color: {themeBackground(theme)};{style ?? ''}"
  aria-hidden="true"
>
  {#if html}
    <code
      class={cn("pointer-events-none block overflow-hidden font-mono", codeClassName)}
      style="font-size: {fontSize}px; line-height: {lineHeight}; white-space: pre;"
      >{@html html}</code
    >
  {:else if fallback}
    {@render fallback()}
  {/if}
</div>
