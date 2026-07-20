/**
 * PresentOverlay — fullscreen presentation stage.
 * Isolated from Editor god component. Only selects autoplay slice + props.
 * Enhancement: HighlightStepIndicator now clickable to jump to steps.
 * Enhancement: Presentation timer + progress bar for autoplay (TypeScript, not Rust — UI animation, no DB needed)
 */
import { memo, useEffect, useState } from "react";
import { Pause, Play, Timer } from "lucide-react";
import { SlidePreview } from "../SlidePreview";
import { HighlightStepIndicator } from "../HighlightStepIndicator";
import { usePresentationControls } from "@/store/ui-selectors";
import type { Project, Slide } from "@/types";
import { cn } from "@/lib/utils";
import { Kbd } from "../ui/kbd";

function useRemainingSec(duration: number, resetKey: string) {
  const [remaining, setRemaining] = useState(() => Math.ceil(duration / 1000));
  useEffect(() => {
    const start = performance.now();
    setRemaining(Math.ceil(duration / 1000));
    const id = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((duration - (performance.now() - start)) / 1000));
      setRemaining((prev) => prev === next ? prev : next);
    }, 100);
    return () => window.clearInterval(id);
  }, [duration, resetKey]);
  return remaining;
}
function formatSec(s: number) { return s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
function PresentProgressBar({ duration, resetKey, className }: { duration: number; resetKey: string; className?: string }) {
  return <div className={cn("overflow-hidden", className)}><div key={resetKey} className="openslides-progress-anim h-full w-full origin-left bg-primary" style={{ animation: `openslides-present-progress ${duration}ms linear forwards` }} /></div>;
}
function AutoplayTimerChip({ duration, resetKey }: { duration: number; resetKey: string }) {
  const remaining = useRemainingSec(duration, resetKey);
  return <div className="flex items-center gap-1.5 rounded-md bg-black/60 px-2.5 py-1 text-xs text-white/80 backdrop-blur"><Timer className="h-3 w-3" /><span className="font-mono tabular-nums">{formatSec(remaining)}</span><span className="text-white/40">/ {Math.ceil(duration / 1000)}s</span></div>;
}
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

  const duration = activeSlide?.duration ?? 3000;
  const resetKey = `${activeSlide?.id}-${duration}-${activeHighlightIndex}`;

  return (
    <div
      id="openslides-present-root"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
    >
      {/* Slide duration progress bar — TypeScript timer, not Rust, for smooth 60fps animation */}
      {isAutoPlaying && <PresentProgressBar duration={duration} resetKey={resetKey} className="absolute left-0 top-0 z-[120] h-1 w-full bg-white/10" />}

      <div className="absolute right-4 top-4 z-[110] flex items-center gap-2">
        {isAutoPlaying && <AutoplayTimerChip duration={duration} resetKey={resetKey} />}
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
          <Kbd tone="onDark" className="px-2 text-xs">ESC</Kbd>{" "}
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
            <div className="flex-1" />
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
