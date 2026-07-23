<script lang="ts">
  /** Collapsed slide rail: numbered slide buttons + the add-slide button. */
  import { Plus } from "@lucide/svelte";
  import { setCurrentSlideId, ui } from "$lib/stores/ui-state.svelte";
  import { cn } from "$lib/lib/utils";
  import type { Slide } from "$lib/types";

  let {
    slides,
    addSlide,
  }: {
    slides: Slide[];
    addSlide: {
      addSlide: () => Promise<unknown> | unknown;
      isPending: boolean;
    };
  } = $props();
</script>

<div
  class="flex h-full min-h-[36px] items-stretch overflow-x-auto border-y border-border/50 bg-card/60"
>
  {#each slides as slide, index (slide.id)}
    <button
      type="button"
      onclick={() => setCurrentSlideId(slide.id)}
      class={cn(
        "flex h-full min-w-11 shrink-0 items-center justify-center border-r border-border/60 px-3 text-sm font-bold tabular-nums transition-colors",
        ui.currentSlideId === slide.id
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
      title="Slide {index + 1}"
    >
      {index + 1}
    </button>
  {/each}
  <button
    type="button"
    onclick={() => void addSlide.addSlide()}
    disabled={addSlide.isPending}
    class="flex h-full min-w-11 shrink-0 items-center justify-center px-3 text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary disabled:opacity-50"
    title="Add slide"
  >
    <Plus class="h-4 w-4" />
  </button>
</div>
