/**
 * Live slide preview using shared Shiki singleton + magic-move.
 * Fixed: now uses per-slide atom for code to avoid re-render storm.
 * Fix: reads instant preview overrides from Zustand (previewProject / previewSlides / previewHighlights)
 * so fontSize / lineHeight / transitions update live during drag, not only on commit.
 */
import { useRef, useMemo } from "react";
import { useShikiDisplay } from "@/hooks/useShikiDisplay";
import {
  themeBackground,
  resolveProjectLanguage,
  type Project,
} from "@/types";
import { useEffectiveSettings } from "@/hooks/useEffectiveSettings";
import { usePreviewHighlightsMap } from "@/hooks/usePreviewSettings";
import { useSlideCode } from "@/hooks/useSlideCode";
import { useCurrentSlide } from "@/hooks/useCurrentSlide";
import { HighlightLayer } from "./HighlightLayer";
import { MagicMoveBlock } from "./preview/MagicMoveBlock";
import { PreviewFallback } from "./preview/PreviewFallback";
import { PreviewStage } from "./preview/PreviewStage";

interface SlidePreviewProps {
  project: Project;
  isPresenting?: boolean;
  activeHighlightIndex?: number;
  onHighlightExitComplete?: () => void;
}

export function SlidePreview({
  project,
  isPresenting = false,
  activeHighlightIndex = -1,
  onHighlightExitComplete,
}: SlidePreviewProps) {
  const { activeSlide: slide } = useCurrentSlide(project);
  const code = useSlideCode(slide?.id, slide?.code ?? "");
  const containerRef = useRef<HTMLDivElement>(null);
  const codeContainerRef = useRef<HTMLDivElement>(null);

  // --- instant preview overrides ---
  const useEffective = useEffectiveSettings(project, slide);
  const previewHighlightsMap = usePreviewHighlightsMap();

  const language = resolveProjectLanguage(project);
  const theme = project.theme;

  const {
    shikiLoadFailed,
    displayHighlighter,
    displayTheme,
    displayLanguage,
  } = useShikiDisplay({ theme, language });

  if (!slide) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        No slides
      </div>
    );
  }

  const s = project.settings;
  const settings = { ...s, fontSize: useEffective.fontSize, lineHeight: useEffective.lineHeight };

  const bg = themeBackground(displayTheme);
  const codeAlign = settings.codeAlign === "center" ? "center" : "left";
  const centerBlock = codeAlign === "center";

  const stagePad = isPresenting ? "p-16 md:p-24" : "p-8 md:p-12";

  const rawHighlights = slide.highlights ?? [];
  // Merge per-highlight preview overrides
  const highlights = useMemo(
    () =>
      rawHighlights.map((hl) => {
        const preview = previewHighlightsMap.get(hl.id);
        if (!preview) return hl;
        return { ...hl, ...preview };
      }),
    [rawHighlights, previewHighlightsMap],
  );

  const activeHighlight =
    activeHighlightIndex >= 0 && activeHighlightIndex < highlights.length
      ? highlights[activeHighlightIndex]
      : null;

  const previewFontSize = isPresenting
    ? settings.fontSize * 1.15
    : settings.fontSize;

  if (!displayHighlighter) {
    return (
      <PreviewFallback
        isMerustmarFail={language === "merustmar" && shikiLoadFailed}
        theme={displayTheme}
        code={code}
        fontSize={previewFontSize}
        lineHeight={settings.lineHeight}
        stagePad={stagePad}
        centerBlock={centerBlock}
        bg={bg}
        containerRef={containerRef}
      />
    );
  }

  return (
    <PreviewStage
      containerRef={containerRef}
      bg={bg}
      stagePad={stagePad}
      centerBlock={centerBlock}
    >
      <MagicMoveBlock
        codeContainerRef={codeContainerRef}
        centerBlock={centerBlock}
        lineHeight={settings.lineHeight}
        fontSize={previewFontSize}
        theme={displayTheme}
        language={displayLanguage}
        highlighter={displayHighlighter}
        code={code}
        transition={useEffective.transitionDuration}
        stagger={useEffective.stagger}
        showLineNumbers={settings.showLineNumbers}
      />
      <HighlightLayer
        containerRef={containerRef}
        codeContainerRef={codeContainerRef}
        code={code}
        highlight={activeHighlight}
        highlighter={displayHighlighter}
        theme={displayTheme}
        language={displayLanguage}
        fontSize={previewFontSize}
        lineHeight={settings.lineHeight}
        onExitComplete={onHighlightExitComplete}
      />
    </PreviewStage>
  );
}
