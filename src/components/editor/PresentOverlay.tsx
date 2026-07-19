/**
 * PresentOverlay — fullscreen presentation stage.
 * Isolated from Editor god component. Only selects autoplay slice + props.
 */
import { memo } from "react";
import { Pause, Play } from "lucide-react";
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
  exitPresent: () => void;
}

export const PresentOverlay = memo(function PresentOverlay({
  project,
  activeSlide,
  activeHighlightIndex,
  onHighlightExitComplete,
  goNext,
  goPrev,
  exitPresent,
}: PresentOverlayProps) {
  const { isAutoPlaying, toggleAutoPlaying, setIsAutoPlaying } =
    usePresentationControls();

  return (
    <div
      id="openslides-present-root"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
    >
      <div className="absolute right-4 top-4 z-[110] flex items-center gap-2">
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
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-40 flex justify-center">
            <HighlightStepIndicator
              total={activeSlide?.highlights?.length ?? 0}
              current={activeHighlightIndex}
            />
          </div>
        </div>
      </div>
    </div>
  );
});
