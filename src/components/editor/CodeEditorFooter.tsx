import { Kbd } from "../ui/kbd";
import { HighlightSettingsPanel } from "../HighlightSettingsPanel";
import { SlideTimingSliders } from "./SlideTimingSliders";
import type { Project, Slide } from "@/types";
import type { Highlight } from "@/types";

interface CodeEditorFooterProps {
  project: Project;
  slide: Slide;
  highlightMode: boolean;
  currentHighlights: Highlight[];
  code: string;
  expandedId: string | null;
  previewIndex: number;
  onToggleExpand: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Highlight>) => void;
  onDelete: (id: string) => void;
  onPreview: (index: number) => void;
  onMove: (highlightId: string, direction: 1 | -1) => void;
  onReorder: (ids: string[], rollback: () => void) => void;
}

export function CodeEditorFooter({
  project,
  slide,
  highlightMode,
  currentHighlights,
  code,
  expandedId,
  previewIndex,
  onToggleExpand,
  onUpdate,
  onDelete,
  onPreview,
  onMove,
  onReorder,
}: CodeEditorFooterProps) {
  return (
    <>
      <SlideTimingSliders project={project} slide={slide} />

      {highlightMode && currentHighlights.length === 0 && (
        <div className="shrink-0 border-t border-border/50 bg-muted/20 px-3 py-2">
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Highlight mode is on. Select code, then choose{" "}
            <span className="font-medium text-foreground/80">Add Highlight</span>.
            {" "}During the presentation, highlights play in order with{" "}
            <Kbd className="bg-background px-1 text-[9px]">→</Kbd>{" "}
            or a click.
          </p>
        </div>
      )}

      {(highlightMode || currentHighlights.length > 0) && (
        <HighlightSettingsPanel
          highlights={currentHighlights}
          code={code}
          expandedId={expandedId}
          previewIndex={previewIndex}
          onToggleExpand={onToggleExpand}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onPreview={onPreview}
          onMove={onMove}
          onReorder={onReorder}
        />
      )}
    </>
  );
}
