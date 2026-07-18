/**
 * Live slide preview using shared Shiki singleton + magic-move.
 * codeAlign (project-wide): left | center — centers the code *block*, not text-align.
 *
 * Highlight mode: renders HighlightLayer on top when a highlight is active.
 * The highlight index is controlled by the parent (Editor) during presentation.
 */
import { useEffect, useRef, useState } from "react";
import { ShikiMagicMove } from "shiki-magic-move/react";
import type { Highlighter } from "shiki";
import { getHighlighter } from "@/lib/shiki-instance";
import { highlightMerustmarCode } from "@/lib/merustmar-highlight";
import {
  LIGHT_THEMES,
  themeBackground,
  type Project,
  type Slide,
} from "@/types";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/useUiStore";
import { HighlightLayer } from "./HighlightLayer";

interface SlidePreviewProps {
  project: Project;
  isPresenting?: boolean;
  /** Index of the active highlight (-1 or undefined = no highlight). */
  activeHighlightIndex?: number;
  /** Whether the current highlight is in its outro phase. */
  isHighlightOutro?: boolean;
  /** Callback when the outro animation completes. */
  onHighlightOutroComplete?: () => void;
}

function resolveLanguage(project: Project, _slide: Slide): string {
  return (
    project.settings.language ||
    project.slides[0]?.language ||
    _slide.language ||
    "typescript"
  );
}

export function SlidePreview({
  project,
  isPresenting = false,
  activeHighlightIndex = -1,
  isHighlightOutro = false,
  onHighlightOutroComplete,
}: SlidePreviewProps) {
  const { currentSlideId, localCode } = useUiStore();
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const codeContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getHighlighter().then((h) => {
      if (!cancelled) setHighlighter(h);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const slide =
    project.slides.find((s) => s.id === currentSlideId) ?? project.slides[0];

  if (!slide) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        No slides
      </div>
    );
  }

  const code = localCode[slide.id] ?? slide.code;
  const language = resolveLanguage(project, slide);
  const theme = project.theme;
  const settings = project.settings;
  const bg = themeBackground(theme);
  const isDarkBg = !LIGHT_THEMES.has(theme);
  const canUseShiki =
    highlighter && highlighter.getLoadedLanguages().includes(language);
  const codeAlign = settings.codeAlign === "center" ? "center" : "left";
  const centerBlock = codeAlign === "center";

  const stagePad = isPresenting ? "p-16 md:p-24" : "p-8 md:p-12";

  // Determine the active highlight for this slide
  const highlights = slide.highlights ?? [];
  const activeHighlight =
    activeHighlightIndex >= 0 && activeHighlightIndex < highlights.length
      ? highlights[activeHighlightIndex]
      : null;

  const isHighlightActive =
    activeHighlight !== null && !isHighlightOutro;
  const isHighlightInOutro =
    activeHighlight !== null && isHighlightOutro;

  const previewFontSize = isPresenting
    ? settings.fontSize * 1.15
    : settings.fontSize;

  if (language === "merustmar" && !canUseShiki) {
    const html = highlightMerustmarCode(code, isDarkBg);
    return (
      <div
        ref={containerRef}
        className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl shadow-2xl"
        style={{ backgroundColor: bg }}
      >
        <div
          className={cn(
            "relative z-10 flex h-full w-full",
            stagePad,
            centerBlock ? "items-center justify-center" : "items-center justify-start",
          )}
        >
          <div
            ref={codeContainerRef}
            className={cn(centerBlock ? "w-max max-w-full" : "w-full")}
            style={{
              lineHeight: settings.lineHeight.toString(),
              fontSize: `${previewFontSize.toFixed(1)}px`,
            }}
          >
            <pre
              className="font-mono font-medium tracking-wide text-left"
              style={{ backgroundColor: "transparent", margin: 0, whiteSpace: "pre" }}
              dangerouslySetInnerHTML={{ __html: html || "&nbsp;" }}
            />
          </div>
        </div>

        {activeHighlight && (
          <HighlightLayer
            containerRef={containerRef}
            codeContainerRef={codeContainerRef}
            code={code}
            highlight={activeHighlight}
            highlighter={highlighter}
            theme={theme}
            language={language}
            fontSize={previewFontSize}
            lineHeight={settings.lineHeight}
            isPresenting={isPresenting}
            isActive={isHighlightActive}
            isOutro={isHighlightInOutro}
            onOutroComplete={onHighlightOutroComplete}
          />
        )}
      </div>
    );
  }

  if (!highlighter || !canUseShiki) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        Loading highlighter…
      </div>
    );
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
        <div
          ref={codeContainerRef}
          className={cn(centerBlock ? "w-max max-w-full" : "w-full")}
          style={
            {
              "--line-height": settings.lineHeight.toString(),
              "--font-size": `${previewFontSize.toFixed(1)}px`,
            } as React.CSSProperties
          }
        >
          <ShikiMagicMove
            key={`${theme}-${settings.showLineNumbers}-${settings.fontSize}-${language}`}
            lang={language}
            theme={theme}
            highlighter={highlighter}
            code={code}
            options={{
              duration: settings.useGlobalTransition
                ? settings.globalTransitionDuration
                : slide.transitionDuration,
              stagger: settings.useGlobalStagger
                ? settings.globalStagger
                : slide.stagger,
              lineNumbers: settings.showLineNumbers,
            }}
            className="shiki-magic-move-container font-mono font-medium tracking-wide"
          />
        </div>
      </div>

      {activeHighlight && (
        <HighlightLayer
          containerRef={containerRef}
          codeContainerRef={codeContainerRef}
          code={code}
          highlight={activeHighlight}
          highlighter={highlighter}
          theme={theme}
          language={language}
          fontSize={previewFontSize}
          lineHeight={settings.lineHeight}
          isPresenting={isPresenting}
          isActive={isHighlightActive}
          isOutro={isHighlightInOutro}
          onOutroComplete={onHighlightOutroComplete}
        />
      )}
    </div>
  );
}
