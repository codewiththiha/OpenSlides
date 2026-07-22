/**
 * PresentOverlay — fullscreen presentation stage.
 * Isolated from Editor god component. Only selects autoplay slice + props.
 * Enhancement: HighlightStepIndicator now clickable to jump to steps.
 * Enhancement: Presentation timer + progress bar for autoplay (TypeScript, not Rust — UI animation, no DB needed)
 */
import { memo } from "react";
import { SlidePreview } from "../SlidePreview";
import { HighlightStepIndicator } from "../HighlightStepIndicator";
import { ProgressBar } from "../ui/progress-bar";
import { AutoplayTimerChip } from "../presentation/AutoplayTimerChip";
import { PresentControls } from "../presentation/PresentControls";
import { usePresentationControls } from "@/store/ui-selectors";
import type { Project, Slide } from "@/types";
import { Z_INDEX } from "../ui/overlay";

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
      className="fixed inset-0 flex items-center justify-center bg-black"
      style={{ zIndex: Z_INDEX.presentation }}
    >
      {/* Slide duration progress bar — TypeScript timer, not Rust, for smooth 60fps animation */}
      {isAutoPlaying && (
        <ProgressBar
          duration={duration}
          resetKey={resetKey}
          className="absolute left-0 top-0 h-1 w-full bg-white/10"
          style={{ zIndex: Z_INDEX.presentationProgress }}
        />
      )}

      <div className="absolute right-4 top-4 flex items-center gap-2" style={{ zIndex: Z_INDEX.presentationControls }}>
        {isAutoPlaying && (
          <AutoplayTimerChip duration={duration} resetKey={resetKey} />
        )}
        <PresentControls
          isAutoPlaying={isAutoPlaying}
          onToggleAutoplay={toggleAutoPlaying}
          onExit={() => void exitPresent()}
        />
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
          {project.settings.showHighlightStepIndicator !== false && (
            <div className="absolute inset-x-0 bottom-4 z-40 flex items-center justify-between px-4">
              <div className="flex-1" />
              <div className="pointer-events-none flex justify-center">
              <div
                className="pointer-events-auto"
                onClick={(event) => event.stopPropagation()}
                onContextMenu={(event) => event.stopPropagation()}
              >
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
          )}
        </div>
      </div>
    </div>
  );
});
