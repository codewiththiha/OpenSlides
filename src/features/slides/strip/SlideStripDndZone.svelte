<script lang="ts">
  /**
   * The dndzone wrapper. It must contain ONLY item children (the lib pairs
   * children to items by index), so anything else (add button…) renders
   * outside it.
   */
  import type { Snippet } from "svelte";
  import { dndzone } from "svelte-dnd-action";
  import { flip } from "svelte/animate";
  import type { StripItem } from "../slide-strip-state.svelte";

  let {
    dnd,
    flipMs,
    dragDisabled,
    renderItem,
  }: {
    dnd: {
      items: StripItem[];
      zoneEl: HTMLElement | undefined;
      handleConsider: (e: CustomEvent) => void;
      handleFinalize: (e: CustomEvent) => void;
    };
    flipMs: number;
    dragDisabled: boolean;
    renderItem: Snippet<[item: StripItem]>;
  } = $props();
</script>

<div
  bind:this={dnd.zoneEl}
  class="relative flex min-h-0 shrink-0 items-center gap-2"
  role="listbox"
  aria-label="Slides"
  use:dndzone={{
    items: dnd.items,
    flipDurationMs: flipMs,
    dragDisabled,
    type: "slide-strip",
    dropTargetStyle: {},
    zoneItemTabIndex: -1,
    zoneTabIndex: -1,
    morphDisabled: true,
  }}
  onconsider={dnd.handleConsider}
  onfinalize={dnd.handleFinalize}
>
  {#each dnd.items as item (item.id)}
    <div animate:flip={{ duration: flipMs }} class="relative shrink-0">
      {@render renderItem(item)}
    </div>
  {/each}
</div>
