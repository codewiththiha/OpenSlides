<script lang="ts">
  /**
   * PresentOverlay — fullscreen presentation stage.
   * HighlightStepIndicator is clickable to jump to steps.
   * Presentation timer + progress bar for autoplay (UI animation only).
   */
  import SlidePreview from "$lib/components/SlidePreview.svelte";
  import HighlightStepIndicator from "@/features/highlights/HighlightStepIndicator.svelte";
  import ProgressBar from "$lib/ui/ProgressBar.svelte";
  import AutoplayTimerChip from "@/features/presentation/AutoplayTimerChip.svelte";
  import PresentControls from "@/features/presentation/PresentControls.svelte";
  import { ui, toggleAutoPlaying, setIsAutoPlaying } from "$lib/stores/ui-state.svelte";
  import type { Project, Slide } from "$lib/types";
  import { Z_INDEX } from "$lib/ui/Overlay.svelte";

  let {
    project,
    activeSlide,
    activeHighlightIndex,
    onHighlightExitComplete,
    goNext,
    goPrev,
    goToHighlight,
    exitPresent,
  }: {
    project: Project;
    activeSlide?: Slide;
    activeHighlightIndex: number;
    onHighlightExitComplete: () => void;
    goNext: () => boolean;
    goPrev: () => boolean;
    goToHighlight: (index: number) => boolean;
    exitPresent: () => void;
  } = $props();

  const isAutoPlaying = $derived(ui.isAutoPlaying);
  const duration = $derived(activeSlide?.duration ?? 3000);
  const resetKey = $derived(
    `${activeSlide?.id}-${duration}-${activeHighlightIndex}`,
  );
</script>

<div
  id="openslides-present-root"
  class="fixed inset-0 flex items-center justify-center bg-black"
  style="z-index: {Z_INDEX.presentation}"
>
  <!-- Slide duration progress bar — UI timer for smooth 60fps animation -->
  {#if isAutoPlaying}
    <ProgressBar
      {duration}
      {resetKey}
      class="absolute left-0 top-0 h-1 w-full bg-white/10"
      style="z-index: {Z_INDEX.presentationProgress}"
    />
  {/if}

  <div class="absolute right-4 top-4 flex items-center gap-2" style="z-index: {Z_INDEX.presentationControls}">
    {#if isAutoPlaying}
      <AutoplayTimerChip {duration} {resetKey} />
    {/if}
    <PresentControls
      {isAutoPlaying}
      onToggleAutoplay={toggleAutoPlaying}
      onExit={() => void exitPresent()}
    />
  </div>

  <!-- Full-bleed stage — Click next, right-click back -->
  <div
    class="flex h-full w-full cursor-pointer items-center justify-center p-0 sm:p-4"
    role="presentation"
    onclick={() => {
      setIsAutoPlaying(false);
      goNext();
    }}
    oncontextmenu={(e) => {
      e.preventDefault();
      setIsAutoPlaying(false);
      goPrev();
    }}
  >
    <div class="relative aspect-video h-full max-h-full w-full max-w-full">
      <SlidePreview
        {project}
        isPresenting
        {activeHighlightIndex}
        {onHighlightExitComplete}
      />
      {#if project.settings.showHighlightStepIndicator !== false}
        <div class="absolute inset-x-0 bottom-4 z-40 flex items-center justify-between px-4">
          <div class="flex-1"></div>
          <div class="pointer-events-none flex justify-center">
            <div
              class="pointer-events-auto"
              onclick={(event) => event.stopPropagation()}
              oncontextmenu={(event) => event.stopPropagation()}
              role="presentation"
            >
              <HighlightStepIndicator
                total={activeSlide?.highlights?.length ?? 0}
                current={activeHighlightIndex}
                onSelect={(idx) => {
                  setIsAutoPlaying(false);
                  goToHighlight(idx);
                }}
              />
            </div>
          </div>
          <div class="flex-1"></div>
        </div>
      {/if}
    </div>
  </div>
</div>
