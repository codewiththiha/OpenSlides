<script lang="ts">
  import type { Snippet } from "svelte";
  import { RotateCcw } from "@lucide/svelte";
  import Button from "$lib/ui/Button.svelte";

  /** Keeps a renderer failure local to the preview/editor pane. */
  let { children }: { children?: Snippet } = $props();
</script>

<svelte:boundary
  onerror={(error) => console.error("[OpenSlides] renderer failed", error)}
>
  {@render children?.()}

  {#snippet failed(error, reset)}
    <div
      class="flex h-full w-full flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center text-muted-foreground"
    >
      <p class="text-sm text-foreground">
        Rendering error — try a different theme/language
      </p>
      {#if error instanceof Error && error.message}
        <code
          class="max-w-full px-2 font-mono text-[11px] break-words text-muted-foreground/80 select-text"
        >
          {error.message}
        </code>
      {/if}
      <Button type="button" variant="outline" size="sm" onclick={reset}>
        <RotateCcw class="mr-1.5 h-3.5 w-3.5" />
        Retry
      </Button>
    </div>
  {/snippet}
</svelte:boundary>
