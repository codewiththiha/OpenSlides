<script lang="ts">
  import { cn } from "$lib/lib/utils";
  import { fallbackForeground } from "$lib/types";

  let {
    isMerustmarFail,
    theme,
    code,
    fontSize,
    lineHeight,
    stagePad,
    centerBlock,
    bg,
    ref = $bindable(null),
  }: {
    isMerustmarFail: boolean;
    theme: string;
    code: string;
    fontSize: number;
    lineHeight: number;
    stagePad: string;
    centerBlock: boolean;
    bg: string;
    ref?: HTMLDivElement | null;
  } = $props();
</script>

{#if isMerustmarFail}
  <!-- A grammar load failure must not leave Merustmar stuck on a spinner.
       Shiki remains the primary path; plain text is only the last-resort
       display when the custom grammar cannot be loaded. -->
  <div
    bind:this={ref}
    class="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl shadow-2xl"
    style="background-color: {bg}"
  >
    <div
      class={cn(
        "relative z-10 flex h-full w-full",
        stagePad,
        centerBlock
          ? "items-center justify-center"
          : "items-center justify-start",
      )}
    >
      <pre
        class="text-left font-mono font-medium tracking-wide"
        style="font-size: {fontSize}px; line-height: {lineHeight}; color: {fallbackForeground(
          theme,
        )}; white-space: pre;">{code}</pre>
    </div>
  </div>
{:else}
  <div
    class="flex h-full w-full items-center justify-center text-muted-foreground"
  >
    Loading preview…
  </div>
{/if}
