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
import { api } from "@/lib/tauri-api";
import {
  LIGHT_THEMES,
  themeBackground,
  resolveProjectLanguage,
  type Project,
} from "@/types";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/useUiStore";
import { HighlightLayer } from "./HighlightLayer";

interface SlidePreviewProps {
  project: Project;
  isPresenting?: boolean;
  /** Index of the active highlight (-1 or undefined = no highlight). */
  activeHighlightIndex?: number;
  /** Fired when the highlight outro fully completed (safe to change slide). */
  onHighlightExitComplete?: () => void;
}

export function SlidePreview({
  project,
  isPresenting = false,
  activeHighlightIndex = -1,
  onHighlightExitComplete,
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

  /* These feed hooks below, so they must be computed before the early
     `!slide` return (code is "" then — that branch never renders anyway). */
  const code = slide ? (localCode[slide.id] ?? slide.code) : "";
  const language = resolveProjectLanguage(project);
  const theme = project.theme;
  const isDarkBg = !LIGHT_THEMES.has(theme);
  const canUseShiki =
    highlighter && highlighter.getLoadedLanguages().includes(language);
  const needsMerustmar = language === "merustmar" && !canUseShiki;

  // Merustmar fallback HTML — rendered in Rust (off the main thread; the
  // old sync-in-render approach recomputed the whole slide per render step).
  // The result is tracked with the code/theme it belongs to via a request
  // token, so out-of-order resolves can never flash mismatched text; while
  // Rust is answering, the previous frame simply stays visible (≤1 RPC of
  // lag). The frozen JS seeds frame one (correct on mount) and stays as the
  // failure fallback, per repo policy.
  const [mmHtml, setMmHtml] = useState<{
    code: string;
    dark: boolean;
    html: string;
  } | null>(() =>
    needsMerustmar
      ? { code, dark: isDarkBg, html: highlightMerustmarCode(code, isDarkBg) }
      : null,
  );
  const mmReqRef = useRef(0);
  useEffect(() => {
    if (!needsMerustmar) return;
    const req = ++mmReqRef.current;
    const dark = isDarkBg;
    api
      .merustmarHighlightCode(code, dark)
      .then((html) => {
        if (mmReqRef.current === req) setMmHtml({ code, dark, html });
      })
      .catch(() => {
        if (mmReqRef.current === req) {
          setMmHtml({ code, dark, html: highlightMerustmarCode(code, dark) });
        }
      });
  }, [needsMerustmar, code, isDarkBg]);

  if (!slide) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        No slides
      </div>
    );
  }

  const settings = project.settings;
  const bg = themeBackground(theme);
  const codeAlign = settings.codeAlign === "center" ? "center" : "left";
  const centerBlock = codeAlign === "center";

  const stagePad = isPresenting ? "p-16 md:p-24" : "p-8 md:p-12";

  // Determine the active highlight for this slide.
  // null = clean state; the layer plays the outro on the way down.
  const highlights = slide.highlights ?? [];
  const activeHighlight =
    activeHighlightIndex >= 0 && activeHighlightIndex < highlights.length
      ? highlights[activeHighlightIndex]
      : null;

  const previewFontSize = isPresenting
    ? settings.fontSize * 1.15
    : settings.fontSize;

  if (needsMerustmar) {
    // Previous frame stays up while the Rust render for the latest code is
    // in flight; empty only before the very first answer in this session.
    const html = mmHtml?.html ?? "";
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
