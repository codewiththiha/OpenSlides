/**
 * Live slide preview using shared Shiki singleton + magic-move.
 * Fixed: now uses per-slide atom for code to avoid re-render storm.
 * Fix: reads instant preview overrides from Zustand (previewProject / previewSlides / previewHighlights)
 * so fontSize / lineHeight / transitions update live during drag, not only on commit.
 */
import { useEffect, useRef, useState, useMemo } from "react";
import { ShikiMagicMove } from "shiki-magic-move/react";
import type { Highlighter } from "shiki";
import { getHighlighter } from "@/lib/shiki-instance";
import { api } from "@/lib/tauri-api";
import {
  merustmarFallbackTokens,
  plainTokenLines,
  renderTokenLines,
  type HighlightTokenLine,
} from "@/lib/highlight-tokens";
import {
  LIGHT_THEMES,
  themeBackground,
  resolveProjectLanguage,
  type Project,
} from "@/types";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/useUiStore";
import { useLocalCodeAtom } from "@/store/localCodeAtoms";
import { HighlightLayer } from "./HighlightLayer";

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
  const currentSlideId = useUiStore((s) => s.currentSlideId);
  const slide =
    project.slides.find((s) => s.id === currentSlideId) ?? project.slides[0];
  // Per-slide atom: only re-renders when THIS slide's override changes
  const codeOverride = useLocalCodeAtom(slide?.id);
  const code = codeOverride ?? slide?.code ?? "";
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const codeContainerRef = useRef<HTMLDivElement>(null);

  // --- instant preview overrides ---
  const previewProject = useUiStore((s) => s.previewProject);
  const previewSlide = useUiStore((s) =>
    slide ? s.previewSlides[slide.id] : undefined,
  );
  const previewHighlightsMap = useUiStore((s) => s.previewHighlights);

  useEffect(() => {
    let cancelled = false;
    getHighlighter().then((h) => {
      if (!cancelled) setHighlighter(h);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const language = resolveProjectLanguage(project);
  const theme = project.theme;
  const isDarkBg = !LIGHT_THEMES.has(theme);
  const canUseShiki =
    highlighter && highlighter.getLoadedLanguages().includes(language);
  const needsMerustmar = language === "merustmar" && !canUseShiki;

  const [mmTokens, setMmTokens] = useState<{
    code: string;
    dark: boolean;
    lines: HighlightTokenLine[];
  } | null>(() =>
    needsMerustmar
      ? { code, dark: isDarkBg, lines: merustmarFallbackTokens(code, isDarkBg) }
      : null,
  );
  const mmReqRef = useRef(0);
  useEffect(() => {
    if (!needsMerustmar) return;
    const controller = new AbortController();
    const req = ++mmReqRef.current;
    const dark = isDarkBg;
    api
      .merustmarTokens(code, dark, controller.signal)
      .then((lines) => {
        if (controller.signal.aborted) return;
        if (mmReqRef.current === req) setMmTokens({ code, dark, lines });
      })
      .catch((err) => {
        if ((err as DOMException)?.name === "AbortError") return;
        if (controller.signal.aborted) return;
        if (mmReqRef.current === req) {
          setMmTokens({ code, dark, lines: merustmarFallbackTokens(code, dark) });
        }
      });
    return () => {
      controller.abort();
    };
  }, [needsMerustmar, code, isDarkBg]);

  if (!slide) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        No slides
      </div>
    );
  }

  // Effective settings: preview overrides win over DB
  const s = project.settings;
  const effectiveFontSize = previewProject.fontSize ?? s.fontSize;
  const effectiveLineHeight = previewProject.lineHeight ?? s.lineHeight;
  const effectiveGlobalTransition =
    previewProject.globalTransitionDuration ?? s.globalTransitionDuration;
  const effectiveGlobalStagger = previewProject.globalStagger ?? s.globalStagger;

  const effectiveSlideTransition =
    previewSlide?.transitionDuration ??
    (s.useGlobalTransition ? effectiveGlobalTransition : slide.transitionDuration);
  const effectiveSlideStagger =
    previewSlide?.stagger ?? (s.useGlobalStagger ? effectiveGlobalStagger : slide.stagger);

  const settings = {
    ...s,
    fontSize: effectiveFontSize,
    lineHeight: effectiveLineHeight,
    globalTransitionDuration: effectiveGlobalTransition,
    globalStagger: effectiveGlobalStagger,
  };

  const bg = themeBackground(theme);
  const codeAlign = settings.codeAlign === "center" ? "center" : "left";
  const centerBlock = codeAlign === "center";

  const stagePad = isPresenting ? "p-16 md:p-24" : "p-8 md:p-12";

  const rawHighlights = slide.highlights ?? [];
  // Merge per-highlight preview overrides
  const highlights = useMemo(
    () =>
      rawHighlights.map((hl) => {
        const preview = previewHighlightsMap[hl.id];
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

  if (needsMerustmar) {
    const html = renderTokenLines(mmTokens?.lines ?? plainTokenLines(code));
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
          onExitComplete={onHighlightExitComplete}
        />
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
            key={`${theme}-${settings.showLineNumbers}-${settings.fontSize}-${settings.lineHeight}-${language}-${effectiveSlideTransition}-${effectiveSlideStagger}`}
            lang={language}
            theme={theme}
            highlighter={highlighter}
            code={code}
            options={{
              duration: effectiveSlideTransition,
              stagger: effectiveSlideStagger,
              lineNumbers: settings.showLineNumbers,
            }}
            className="shiki-magic-move-container font-mono font-medium tracking-wide"
          />
        </div>
      </div>

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
        onExitComplete={onHighlightExitComplete}
      />
    </div>
  );
}
