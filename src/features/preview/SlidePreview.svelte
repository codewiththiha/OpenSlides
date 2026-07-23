<script lang="ts">
  /**
   * Live slide preview using shared Shiki singleton + magic-move.
   * Reads instant preview overrides from the rune store
   * (previewProject / previewSlides / previewHighlights) so
   * fontSize / lineHeight / transitions update live during drag.
   */
  import { magicMoveShikiDisplay } from "$lib/shiki/shiki-display.svelte";
  import {
    themeBackground,
    resolveProjectLanguage,
    type Project,
  } from "$lib/types";
  import { createEffectiveSettings } from "@/features/settings/effective-settings.svelte";
  import {
    previewMergedHighlights,
    previewProjectSetting,
  } from "@/features/settings/preview-settings";
  import { effectiveSlideCode } from "$lib/stores/slide-code.svelte";
  import { createCurrentSlide } from "@/features/slides/current-slide.svelte";
  import HighlightLayer from "@/features/highlights/HighlightLayer.svelte";
  import MagicMoveBlock from "./MagicMoveBlock.svelte";
  import PreviewFallback from "./PreviewFallback.svelte";
  import PreviewStage from "./PreviewStage.svelte";

  let {
    project,
    slideId,
    isPresenting = false,
    activeHighlightIndex = -1,
    onHighlightExitComplete,
  }: {
    project: Project;
    /** Slide to show; falls back to ui.currentSlideId when omitted (§7.3). */
    slideId?: string;
    isPresenting?: boolean;
    activeHighlightIndex?: number;
    onHighlightExitComplete?: () => void;
  } = $props();

  const currentSlide = createCurrentSlide(
    () => project,
    () => slideId,
  );
  const slide = $derived(currentSlide.activeSlide);
  const code = $derived(effectiveSlideCode(slide));

  let containerEl = $state<HTMLDivElement | null>(null);
  let codeContainerEl = $state<HTMLDivElement | null>(null);

  // --- instant preview overrides ---
  const effective = createEffectiveSettings(
    () => project,
    () => slide,
  );

  const language = $derived(resolveProjectLanguage(project));
  const theme = $derived(previewProjectSetting("theme") ?? project.theme);
  const previewBlackCodeBackground = $derived(
    previewProjectSetting("useBlackCodeBackground"),
  );

  const shiki = magicMoveShikiDisplay(() => ({ theme, language }));

  const s = $derived(project.settings);
  const fontSize = $derived(effective.settings.fontSize);
  const lineHeight = $derived(effective.settings.lineHeight);

  const bg = $derived(
    (previewBlackCodeBackground ?? s.useBlackCodeBackground)
      ? "#000000"
      : themeBackground(shiki.displayTheme),
  );
  const centerBlock = $derived(s.codeAlign === "center");

  const stagePad = $derived(isPresenting ? "p-16 md:p-24" : "p-8 md:p-12");

  const rawHighlights = $derived(slide?.highlights ?? []);
  const highlights = $derived(previewMergedHighlights(rawHighlights));

  const activeHighlight = $derived(
    activeHighlightIndex >= 0 && activeHighlightIndex < highlights.length
      ? (highlights[activeHighlightIndex] ?? null)
      : null,
  );

  const previewFontSize = $derived(isPresenting ? fontSize * 1.15 : fontSize);
</script>

{#if !slide}
  <div
    class="flex h-full w-full items-center justify-center text-muted-foreground"
  >
    No slides
  </div>
{:else if !shiki.displayHighlighter}
  <PreviewFallback
    isMerustmarFail={language === "merustmar" && shiki.shikiLoadFailed}
    theme={shiki.displayTheme}
    {code}
    fontSize={previewFontSize}
    {lineHeight}
    {stagePad}
    {centerBlock}
    {bg}
    bind:ref={containerEl}
  />
{:else}
  <PreviewStage bind:ref={containerEl} {bg} {stagePad} {centerBlock}>
    <MagicMoveBlock
      bind:ref={codeContainerEl}
      {centerBlock}
      {lineHeight}
      fontSize={previewFontSize}
      theme={shiki.displayTheme}
      language={shiki.displayLanguage}
      highlighter={shiki.displayHighlighter}
      {code}
      transition={effective.settings.transitionDuration}
      stagger={effective.settings.stagger}
      showLineNumbers={s.showLineNumbers}
    />
    <HighlightLayer
      container={() => containerEl}
      codeContainer={() => codeContainerEl}
      code={() => code}
      highlight={() => activeHighlight}
      highlighter={() => shiki.displayHighlighter}
      theme={() => shiki.displayTheme}
      language={() => shiki.displayLanguage}
      fontSize={() => previewFontSize}
      lineHeight={() => lineHeight}
      onExitComplete={onHighlightExitComplete}
    />
  </PreviewStage>
{/if}
