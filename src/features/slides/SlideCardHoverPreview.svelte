<script lang="ts">
  /** Fixed-position hover preview, portaled to body. */
  import CodeThumbnail from "$lib/ui/CodeThumbnail.svelte";
  import { Z_INDEX } from "$lib/ui/Overlay.svelte";
  import { portal } from "$lib/actions/portal";

  let {
    show,
    html,
    containerEl = $bindable(null),
    theme,
    left,
    top,
  }: {
    show: boolean;
    html: string | null | undefined;
    containerEl?: HTMLDivElement | null;
    theme: string;
    left: number;
    top: number;
  } = $props();
</script>

{#if show && html}
  <div use:portal>
    <CodeThumbnail
      bind:ref={containerEl}
      html={html ?? null}
      {theme}
      fontSize={8}
      class="pointer-events-none fixed h-[170px] w-[300px] rounded-lg border border-border bg-card p-2 shadow-2xl"
      style="left: {left}px; top: {top}px; z-index: {Z_INDEX.hoverPreview};"
    />
  </div>
{/if}
