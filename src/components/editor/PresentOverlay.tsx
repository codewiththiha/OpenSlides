/**
 * PresentOverlay — fullscreen presentation stage.
 * Isolated from Editor god component. Only selects autoplay slice + props.
 * Enhancement: HighlightStepIndicator now clickable to jump to steps.
 * Enhancement: Presentation timer + progress bar for autoplay (TypeScript, not Rust — UI animation, no DB needed)
 */
import { memo, useEffect, useRef, useState } from "react";
import { Pause, Play, Timer } from "lucide-react";
import { SlidePreview } from "../SlidePreview";
import { HighlightStepIndicator } from "../HighlightStepIndicator";
import { usePresentationControls } from "@/store/ui-selectors";
import type { Project, Slide } from "@/types";

interface PresentOverlayProps {
  project: Project;
  activeSlide?: Slide;
  activeHighlightIndex: number;
  onHighlightExitComplete: () => void;
  goNext: () => boolean;
  goPrev: () => boolean;
  goToHighlight: (index: number) => boolean;
  exitPresent: () => void;
}

export const PresentOverlay = memo(function PresentOverlay({
  project,
  activeSlide,
  activeHighlightIndex,
  onHighlightExitComplete,
  goNext,
  goPrev,
  goToHighlight,
  exitPresent,
}: PresentOverlayProps) {
  const { isAutoPlaying, toggleAutoPlaying, setIsAutoPlaying } =
    usePresentationControls();

  // Presentation timer — TypeScript, not Rust: UI animation, countdown, no DB/IO needed
  // Rust would add IPC round-trip per 100ms tick, worse UX. TS is correct choice.
  const [progress, setProgress] = useState(0);
  const [remainingMs, setRemainingMs] = useState(activeSlide?.duration ?? 3000);
  const startRef = useRef<number>(performance.now());

  useEffect(() => {
    if (!isAutoPlaying) {
      setProgress(0);
      setRemainingMs(activeSlide?.duration ?? 3000);
      return;
    }
    const duration = activeSlide?.duration ?? 3000;
    startRef.current = performance.now();
    setProgress(0);
    setRemainingMs(duration);

    const id = window.setInterval(() => {
      const elapsed = performance.now() - startRef.current;
      const p = Math.min(elapsed / duration, 1);
      setProgress(p);
      setRemainingMs(Math.max(duration - elapsed, 0));
    }, 100);

    return () => window.clearInterval(id);
  }, [isAutoPlaying, activeSlide?.id, activeSlide?.duration, activeHighlightIndex]);

  const formatRemaining = (ms: number) => {
    const s = Math.ceil(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div
      id="openslides-present-root"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
    >
      {/* Slide duration progress bar — TypeScript timer, not Rust, for smooth 60fps animation */}
      {isAutoPlaying && (
        <div className="absolute left-0 top-0 z-[120] h-1 w-full bg-white/10">
          <div
            className="h-full bg-primary transition-all duration-100 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      <div className="absolute right-4 top-4 z-[110] flex items-center gap-2">
        {isAutoPlaying && (
          <div className="flex items-center gap-1.5 rounded-md bg-black/60 px-2.5 py-1 text-xs text-white/80 backdrop-blur">
            <Timer className="h-3 w-3" />
            <span className="font-mono tabular-nums">{formatRemaining(remainingMs)}</span>
            <span className="text-white/40">/ {Math.ceil((activeSlide?.duration ?? 3000) / 1000)}s</span>
          </div>
        )}
        <button
          type="button"
          className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 text-sm text-white/70 transition hover:bg-white/20 hover:text-white"
          onClick={() => toggleAutoPlaying()}
          title={isAutoPlaying ? "Pause autoplay" : "Play (auto-advance)"}
        >
          {isAutoPlaying ? (
            <Pause className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">
            {isAutoPlaying ? "Pause" : "Play"}
          </span>
        </button>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 text-sm text-white/70 transition hover:bg-white/20 hover:text-white"
          onClick={() => void exitPresent()}
        >
          Press{" "}
          <kbd className="rounded bg-white/20 px-2 py-0.5 font-mono text-xs">
            ESC
          </kbd>{" "}
          to exit
        </button>
      </div>

      {/* Full-bleed stage — Click next, right-click back */}
      <div
        className="flex h-full w-full cursor-pointer items-center justify-center p-0 sm:p-4"
        onClick={() => {
          setIsAutoPlaying(false);
          goNext();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setIsAutoPlaying(false);
          goPrev();
        }}
      >
        <div className="relative aspect-video h-full max-h-full w-full max-w-full">
          <SlidePreview
            project={project}
            isPresenting
            activeHighlightIndex={activeHighlightIndex}
            onHighlightExitComplete={onHighlightExitComplete}
          />
          {/* Bottom bar: timer (left) + highlight dots (center) — both clickable */}
          <div className="absolute inset-x-0 bottom-4 z-40 flex items-center justify-between px-4">
            <div className="pointer-events-none flex-1">
              {isAutoPlaying && (
                <div className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] text-white/80 shadow backdrop-blur">
                  <div className="h-1.5 w-12 rounded-full bg-white/20 overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${progress * 100}%` }} />
                  </div>
                  <span className="font-mono tabular-nums">{formatRemaining(remainingMs)}</span>
                </div>
              )}
            </div>
            <div className="pointer-events-none flex justify-center">
              <div className="pointer-events-auto">
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
            <div className="flex-1" />
          </div>
        </div>
      </div>
    </div>
  );
});
