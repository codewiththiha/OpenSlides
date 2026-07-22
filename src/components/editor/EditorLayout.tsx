/**
 * EditorLayout — resizable preview + code + slides rail.
 * Extracted from God Editor. Owns panel refs, collapsible logic, and
 * minimal Zustand panel slice (no saveStatus / localCode).
 * Enhancement: HighlightStepIndicator now clickable via onSelectHighlight.
 */
import { memo, useRef } from "react";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type ImperativePanelHandle,
} from "react-resizable-panels";
import { Code2 } from "lucide-react";
import { CodeEditor } from "../CodeEditor";
import { BottomSlidesPanel } from "../BottomSlidesPanel";
import { RenderErrorBoundary } from "../RenderErrorBoundary";
import { PreviewPane } from "./PreviewPane";
import { CollapsedPanelButton } from "../ui/collapsed-panel-button";
import { usePanelSlice, useZenSlice } from "@/store/ui-selectors";
import { useCollapsiblePanel } from "@/hooks/useCollapsiblePanel";
import { cn } from "@/lib/utils";
import type { Project, Slide } from "@/types";
import { Z_INDEX } from "../ui/overlay";

const CODE_COLLAPSE_THRESHOLD = 14;
const SLIDES_MIN_EXPANDED_SIZE = 20;
const SLIDES_COLLAPSE_THRESHOLD = SLIDES_MIN_EXPANDED_SIZE;
const CODE_COLLAPSED_SIZE = 3.5;
const SLIDES_COLLAPSED_SIZE = 6;

interface EditorLayoutProps {
  project: Project;
  activeSlide?: Slide;
  activeHighlightIndex: number;
  previewHighlightIndex: number;
  onHighlightExitComplete: () => void;
  onSelectHighlight: (index: number) => boolean;
  editorExpanded: boolean;
  onToggleEditorExpanded: (v: boolean) => void;
}

export const EditorLayout = memo(function EditorLayout({
  project,
  activeSlide,
  activeHighlightIndex,
  previewHighlightIndex,
  onHighlightExitComplete,
  onSelectHighlight,
  editorExpanded,
  onToggleEditorExpanded,
}: EditorLayoutProps) {
  const {
    isBottomPanelCollapsed,
    setIsBottomPanelCollapsed,
    isCodePanelCollapsed,
    setIsCodePanelCollapsed,
    codePanelSize,
    setCodePanelSize,
    slidesPanelSize,
    setSlidesPanelSize,
  } = usePanelSlice();

  const { isZenMode } = useZenSlice();

  const codePanelRef = useRef<ImperativePanelHandle>(null);
  const slidesPanelRef = useRef<ImperativePanelHandle>(null);
  // Older saved layouts may be smaller; never restore an expanded slides rail
  // below the space required for a complete centered card.
  const slidesExpandedSize = Math.max(SLIDES_MIN_EXPANDED_SIZE, slidesPanelSize);

  const {
    expand: expandCodePanel,
    collapse: collapseCodePanel,
    onResize: onCodePanelResize,
  } = useCollapsiblePanel({
    panelRef: codePanelRef,
    isCollapsed: isCodePanelCollapsed,
    setCollapsed: setIsCodePanelCollapsed,
    size: codePanelSize,
    setSize: setCodePanelSize,
    collapseThreshold: CODE_COLLAPSE_THRESHOLD,
  });

  const {
    expand: expandSlidesPanel,
    collapse: collapseSlidesPanel,
    onResize: onSlidesPanelResize,
  } = useCollapsiblePanel({
    panelRef: slidesPanelRef,
    isCollapsed: isBottomPanelCollapsed,
    setCollapsed: setIsBottomPanelCollapsed,
    size: slidesExpandedSize,
    setSize: setSlidesPanelSize,
    collapseThreshold: SLIDES_COLLAPSE_THRESHOLD,
  });

  // Resolve effective highlight index (preview override)
  const effectiveHighlight =
    previewHighlightIndex >= 0 ? previewHighlightIndex : activeHighlightIndex;

  return (
    <>
      {editorExpanded && (
        <div className="fixed inset-0 bg-background/98 p-4 backdrop-blur-xl" style={{ zIndex: Z_INDEX.editorExpanded }}>
          <RenderErrorBoundary key={`expanded-editor-${project.id}`}>
            <CodeEditor
              project={project}
              expanded
              onToggleExpand={() => onToggleEditorExpanded(false)}
            />
          </RenderErrorBoundary>
        </div>
      )}

      <div className={cn("flex min-h-0 flex-1 flex-col", isZenMode && "pt-0")}>
        <PanelGroup
          direction="vertical"
          className="min-h-0 flex-1"
        >
          <Panel
            defaultSize={isZenMode ? 100 : 78}
            minSize={35}
            className="min-h-0"
          >
            <PanelGroup
              direction="horizontal"
              className="h-full min-h-0"
            >
              <Panel
                defaultSize={
                  isCodePanelCollapsed
                    ? 100 - CODE_COLLAPSED_SIZE
                    : 100 - codePanelSize
                }
                minSize={30}
                className="min-w-0"
              >
                <PreviewPane
                  project={project}
                  activeSlide={activeSlide}
                  effectiveHighlight={effectiveHighlight}
                  onHighlightExitComplete={onHighlightExitComplete}
                  onSelectHighlight={onSelectHighlight}
                />
              </Panel>

              {!isZenMode && (
                <>
                  <PanelResizeHandle
                    className={cn(
                      "w-1.5 bg-border/60 transition-colors hover:bg-primary/50 data-[resize-handle-active]:bg-primary/60",
                      isCodePanelCollapsed && "w-1.5 hover:bg-primary/60"
                    )}
                  />

                  <Panel
                    ref={codePanelRef}
                    defaultSize={
                      isCodePanelCollapsed ? CODE_COLLAPSED_SIZE : codePanelSize
                    }
                    minSize={CODE_COLLAPSED_SIZE}
                    maxSize={70}
                    collapsible
                    collapsedSize={CODE_COLLAPSED_SIZE}
                    className="min-w-0"
                    onResize={onCodePanelResize}
                    onCollapse={() => setIsCodePanelCollapsed(true)}
                    onExpand={() => setIsCodePanelCollapsed(false)}
                  >
                    {isCodePanelCollapsed ? (
                      <CollapsedPanelButton
                        orientation="vertical"
                        icon={Code2}
                        label="Code"
                        onClick={expandCodePanel}
                        title="Expand code editor (or drag the handle)"
                      />
                    ) : (
                      <RenderErrorBoundary key={`editor-${project.id}`}>
                        <CodeEditor
                          project={project}
                          onToggleExpand={() => onToggleEditorExpanded(true)}
                          onCollapse={collapseCodePanel}
                        />
                      </RenderErrorBoundary>
                    )}
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>

          {!isZenMode && (
            <>
              <PanelResizeHandle
                className={cn(
                  "h-1.5 bg-border/60 transition-colors hover:bg-primary/50 data-[resize-handle-active]:bg-primary/60",
                  isBottomPanelCollapsed && "h-1.5"
                )}
              />
              <Panel
                ref={slidesPanelRef}
                defaultSize={
                  isBottomPanelCollapsed
                    ? SLIDES_COLLAPSED_SIZE
                    : slidesExpandedSize
                }
                minSize={SLIDES_COLLAPSED_SIZE}
                maxSize={40}
                collapsible
                collapsedSize={SLIDES_COLLAPSED_SIZE}
                className="min-h-0"
                onResize={onSlidesPanelResize}
                onCollapse={() => setIsBottomPanelCollapsed(true)}
                onExpand={() => setIsBottomPanelCollapsed(false)}
              >
                <BottomSlidesPanel
                  project={project}
                  collapsed={isBottomPanelCollapsed}
                  activeHighlightIndex={activeHighlightIndex}
                  onToggleCollapse={() => {
                    if (isBottomPanelCollapsed) expandSlidesPanel();
                    else collapseSlidesPanel();
                  }}
                />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>
    </>
  );
});
