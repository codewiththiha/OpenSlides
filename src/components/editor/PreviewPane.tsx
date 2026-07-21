import { SlidePreview } from "../SlidePreview";
import { RenderErrorBoundary } from "../RenderErrorBoundary";
import { HighlightStepIndicator } from "../HighlightStepIndicator";
import type { Project, Slide } from "@/types";

interface PreviewPaneProps {
  project: Project;
  activeSlide?: Slide;
  effectiveHighlight: number;
  onHighlightExitComplete: () => void;
  onSelectHighlight: (index: number) => boolean;
}

export function PreviewPane({
  project,
  activeSlide,
  effectiveHighlight,
  onHighlightExitComplete,
  onSelectHighlight,
}: PreviewPaneProps) {
  return (
    <div className="flex h-full items-center justify-center bg-muted/20 p-4 pb-5">
      <div className="relative aspect-video h-full max-h-full w-full max-w-full">
        <RenderErrorBoundary key={`preview-${project.id}`}>
          <SlidePreview
            project={project}
            activeHighlightIndex={effectiveHighlight}
            onHighlightExitComplete={onHighlightExitComplete}
          />
        </RenderErrorBoundary>
        {/* Clickable indicator: pointer-events-auto wrapper */}
        <div className="absolute inset-x-0 bottom-2.5 z-40 flex justify-center pointer-events-none">
          <div className="pointer-events-auto">
            <HighlightStepIndicator
              compact
              total={activeSlide?.highlights?.length ?? 0}
              current={effectiveHighlight}
              onSelect={(idx) => onSelectHighlight(idx)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
