<script lang="ts">
  /**
   * Live slide preview using shared Shiki singleton + magic-move.
   * Reads instant preview overrides from the rune store
   * (previewProject / previewSlides / previewHighlights) so
   * fontSize / lineHeight / transitions update live during drag.
   */
  import { useShikiDisplay } from "@/hooks/useShikiDisplay";
  import {
    themeBackground,
    resolveProjectLanguage,
    type Project,
  } from "@/types";
  import { useEffectiveSettings } from "@/hooks/useEffectiveSettings.svelte";
  import {
    previewMergedHighlights,
    previewProjectSetting,
  } from "@/hooks/usePreviewSettings";
  import { localCode } from "@/store/slide-code.svelte";
  import { useCurrentSlide } from "@/hooks/useCurrentSlide.svelte";
  import HighlightLayer from "./HighlightLayer.svelte";
  import MagicMoveBlock from "./preview/MagicMoveBlock.svelte";
  import PreviewFallback from "./preview/PreviewFallback.svelte";
  import PreviewStage from "./preview/PreviewStage.svelte";

  let {
    project,
    isPresenting = false,
    activeHighlightIndex = -1,
    onHighlightExitComplete,
  }: {
    project: Project;
    isPresenting?: boolean;
    activeHighlightIndex?: number;
    onHighlightExitComplete?: () => void;
  } = $props();

  const currentSlide = useCurrentSlide(() => project);
  const slide = $derived(currentSlide.activeSlide);
  const code = $derived(slide ? (localCode[slide.id] ?? slide.code) : "");

  let containerEl = $state<HTMLDivElement | null>(null);
  let codeContainerEl = $state<HTMLDivElement | null>(null);

  // --- instant preview overrides ---
  const effective = useEffectiveSettings(() => project, () => slide);

  const language = $derived(resolveProjectLanguage(project));
  const theme = $derived(previewProjectSetting("theme") ?? project.theme);
  const previewBlackCodeBackground = $derived(
    previewProjectSetting("useBlackCodeBackground"),
  );

  const shiki = useShikiDisplay(() => ({ theme, language }));

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
      ? highlights[activeHighlightIndex]
      : null,
  );

  const previewFontSize = $derived(isPresenting ? fontSize * 1.15 : fontSize);
</script>

{#if !slide}
  <div class="flex h-full w-full items-center justify-center text-muted-foreground">
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
