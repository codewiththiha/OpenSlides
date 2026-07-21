/**
 * Live slide preview using shared Shiki singleton + magic-move.
 * Fixed: now uses per-slide atom for code to avoid re-render storm.
 * Fix: reads instant preview overrides from Zustand (previewProject / previewSlides / previewHighlights)
 * so fontSize / lineHeight / transitions update live during drag, not only on commit.
 */
import { memo, useEffect, useRef, useState, useMemo } from "react";
import { ShikiMagicMove } from "shiki-magic-move/react";
import type { Highlighter } from "shiki";
import { getHighlighter } from "@/lib/shiki-instance";
import {
  themeBackground,
  resolveProjectLanguage,
  fallbackForeground,
  type Project,
} from "@/types";
import { useEffectiveSettings } from "@/hooks/useEffectiveSettings";
import { cn } from "@/lib/utils";
import { usePreviewHighlightsMap } from "@/hooks/usePreviewSettings";
import { useSlideCode } from "@/hooks/useSlideCode";
import { useCurrentSlide } from "@/hooks/useCurrentSlide";
import { HighlightLayer } from "./HighlightLayer";

interface SlidePreviewProps {
  project: Project;
  isPresenting?: boolean;
  activeHighlightIndex?: number;
  onHighlightExitComplete?: () => void;
}

const MagicMoveBlock = memo(function MagicMoveBlock({
  codeContainerRef,
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
  codeContainerRef: React.RefObject<HTMLDivElement | null>;
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
}) {
  return (
    <div
      ref={codeContainerRef}
      className={cn(centerBlock ? "w-max max-w-full" : "w-full")}
      style={{
        "--line-height": lineHeight.toString(),
        "--font-size": `${fontSize.toFixed(1)}px`,
      } as React.CSSProperties}
    >
      <ShikiMagicMove
            key={`${theme}-${language}`}
            lang={language}
            theme={theme}
            highlighter={highlighter}
            code={code}
        options={{ duration: transition, stagger, lineNumbers: showLineNumbers }}
        className="shiki-magic-move-container font-mono font-medium tracking-wide"
      />
    </div>
  );
});

export function SlidePreview({
  project,
  isPresenting = false,
  activeHighlightIndex = -1,
  onHighlightExitComplete,
}: SlidePreviewProps) {
  const { activeSlide: slide } = useCurrentSlide(project);
  const code = useSlideCode(slide?.id, slide?.code ?? "");
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const [shikiLoadFailed, setShikiLoadFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const codeContainerRef = useRef<HTMLDivElement>(null);

  // --- instant preview overrides ---
  const useEffective = useEffectiveSettings(project, slide);
  const previewHighlightsMap = usePreviewHighlightsMap();

  const language = resolveProjectLanguage(project);
  const theme = project.theme;
  useEffect(() => {
    let cancelled = false;
    const key = `${theme}-${language}`;
    setShikiLoadFailed(false);
    getHighlighter(theme, language).then((h) => {
      if (!cancelled) {
        setHighlighter(h);
        setReadyKey(key);
      }
    }).catch(() => {
      if (!cancelled) {
        setReadyKey(null);
        setShikiLoadFailed(true);
      }
    });
    return () => { cancelled = true; };
  }, [theme, language]);
  const canUseShiki = readyKey === `${theme}-${language}` && !!highlighter;
  const [displayState, setDisplayState] = useState<{
    highlighter: Highlighter;
    theme: string;
    language: string;
  } | null>(null);

  useEffect(() => {
    if (canUseShiki && highlighter) {
      setDisplayState({ highlighter, theme, language });
    }
  }, [canUseShiki, highlighter, theme, language]);

  const displayHighlighter = displayState?.highlighter ?? null;
  const displayTheme = displayState?.theme ?? theme;
  const displayLanguage = displayState?.language ?? language;



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
    // A grammar load failure must not leave Merustmar stuck on a spinner.
    // Shiki remains the primary path; plain text is only the last-resort
    // display when the custom grammar cannot be loaded.
    if (language === "merustmar" && shikiLoadFailed) {
      return (
        <div ref={containerRef} className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl shadow-2xl" style={{ backgroundColor: bg }}>
          <div className={cn("relative z-10 flex h-full w-full", stagePad, centerBlock ? "items-center justify-center" : "items-center justify-start")}>
            <pre className="font-mono font-medium tracking-wide text-left" style={{ fontSize: `${previewFontSize}px`, lineHeight: settings.lineHeight, color: fallbackForeground(displayTheme), whiteSpace: "pre" }}>{code}</pre>
          </div>
        </div>
      );
    }
    return <div className="flex h-full w-full items-center justify-center text-muted-foreground">Loading preview…</div>;
  }

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl shadow-2xl transition-colors duration-500"
      style={{ backgroundColor: bg }}
    >
      <div
        className={cn(
          "relative z-10 flex h-full w-full",
          stagePad,
          centerBlock ? "items-center justify-center" : "items-center justify-start",
        )}
      >
        <style
          dangerouslySetInnerHTML={{
            __html: `
          .shiki-magic-move-container,
          .shiki-magic-move-container pre,
          .shiki-magic-move-container code {
            background-color: transparent !important;
            white-space: pre !important;
            display: block !important;
            line-height: var(--line-height) !important;
            font-size: var(--font-size) !important;
            text-align: left !important;
          }
        `,
          }}
        />
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
      </div>

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
    </div>
  );
}
