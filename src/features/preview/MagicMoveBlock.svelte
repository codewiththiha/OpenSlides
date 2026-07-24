<script lang="ts">
  import { ShikiMagicMove } from "shiki-magic-move/svelte";
  import type { Highlighter } from "shiki";
  import { cn } from "$lib/lib/utils";

  let {
    ref = $bindable(null),
    centerBlock,
    lineHeight,
    fontSize,
    theme,
    language,
    highlighter,
    code,
    transition,
    stagger,
    showLineNumbers,
  }: {
    ref?: HTMLDivElement | null;
    centerBlock: boolean;
    lineHeight: number;
    fontSize: number;
    theme: string;
    language: string;
    highlighter: Highlighter;
    code: string;
    transition: number;
    stagger: number;
    showLineNumbers: boolean;
  } = $props();

  // Keep the Shiki options object reference stable across parent re-renders;
  // only real timing/line-number changes should force a re-init.
  const options = $derived({
    duration: transition,
    stagger,
    lineNumbers: showLineNumbers,
  });
</script>

<div
  bind:this={ref}
  class={cn(centerBlock ? "w-max max-w-full" : "w-full")}
  style="--line-height: {lineHeight}; --font-size: {fontSize.toFixed(1)}px;"
>
  <!--
    Enabling/disabling line numbers changes Shiki Magic Move's DOM schema by
    inserting/removing the gutter. A live morph across that structural change
    can mis-pair tokens, so treat it as a layout-mode switch and remount the
    block in the new schema (same practical effect as a page reload, but only
    for this subtree).
  -->
  {#key `${theme}-${language}-${showLineNumbers}`}
    <ShikiMagicMove
      lang={language}
      {theme}
      {highlighter}
      {code}
      {options}
      class="shiki-magic-move-container font-mono font-medium tracking-wide"
    />
  {/key}
</div>
