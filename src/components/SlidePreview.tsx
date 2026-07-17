/**
 * Live slide preview using shared Shiki singleton + magic-move.
 */
import { useEffect, useState } from "react";
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

interface SlidePreviewProps {
  project: Project;
  isPresenting?: boolean;
}

function resolveLanguage(project: Project, _slide: Slide): string {
  return (
    project.settings.language ||
    project.slides[0]?.language ||
    _slide.language ||
    "typescript"
  );
}

export function SlidePreview({ project, isPresenting = false }: SlidePreviewProps) {
  const { currentSlideId, localCode } = useUiStore();
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);

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

  if (language === "merustmar" && !canUseShiki) {
    const html = highlightMerustmarCode(code, isDarkBg);
    return (
      <div
        className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl shadow-2xl"
        style={{ backgroundColor: bg }}
      >
        <div
          className={cn(
            "relative z-10 flex w-full items-center justify-center",
            isPresenting ? "p-24" : "p-10",
          )}
        >
          <div
            style={{
              width: "100%",
              lineHeight: settings.lineHeight.toString(),
              fontSize: isPresenting
                ? `${(settings.fontSize * 1.15).toFixed(1)}px`
                : `${settings.fontSize}px`,
            }}
          >
            <pre
              className="font-mono font-medium tracking-wide"
              style={{ backgroundColor: "transparent", margin: 0, whiteSpace: "pre" }}
              dangerouslySetInnerHTML={{ __html: html || "&nbsp;" }}
            />
          </div>
        </div>
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
      className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl shadow-2xl transition-colors duration-500"
      style={{ backgroundColor: bg }}
    >
      <div
        className={cn(
          "relative z-10 flex w-full items-center justify-center",
          isPresenting ? "p-24" : "p-10",
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
          }
        `,
          }}
        />
        <div
          style={
            {
              width: "100%",
              "--line-height": settings.lineHeight.toString(),
              "--font-size": isPresenting
                ? `${(settings.fontSize * 1.15).toFixed(1)}px`
                : `${settings.fontSize}px`,
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
    </div>
  );
}
