/**
 * EditorLayout — resizable preview + code + slides rail.
 * Extracted from God Editor. Owns panel refs, collapsible logic, and
 * minimal Zustand panel slice (no saveStatus / localCode).
 */
import { memo, useRef } from "react";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type ImperativePanelHandle,
} from "react-resizable-panels";
import { ChevronLeft, Code2 } from "lucide-react";
import { SlidePreview } from "../SlidePreview";
import { CodeEditor } from "../CodeEditor";
import { BottomSlidesPanel } from "../BottomSlidesPanel";
import { HighlightStepIndicator } from "../HighlightStepIndicator";
import { usePanelSlice, useZenSlice } from "@/store/ui-selectors";
import { useCollapsiblePanel } from "@/hooks/useCollapsiblePanel";
import { cn } from "@/lib/utils";
import type { Project, Slide } from "@/types";

const CODE_COLLAPSE_THRESHOLD = 14;
const SLIDES_COLLAPSE_THRESHOLD = 10;
const CODE_COLLAPSED_SIZE = 3.5;
const SLIDES_COLLAPSED_SIZE = 6;

interface EditorLayoutProps {
  project: Project;
  activeSlide?: Slide;
  activeHighlightIndex: number;
  previewHighlightIndex: number;
  onHighlightExitComplete: () => void;
  editorExpanded: boolean;
  onToggleEditorExpanded: (v: boolean) => void;
}

export const EditorLayout = memo(function EditorLayout({
  project,
  activeSlide,
  activeHighlightIndex,
  previewHighlightIndex,
  onHighlightExitComplete,
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
    size: slidesPanelSize,
    setSize: setSlidesPanelSize,
    collapseThreshold: SLIDES_COLLAPSE_THRESHOLD,
  });

  // Resolve effective highlight index (preview override)
  const effectiveHighlight =
    previewHighlightIndex >= 0 ? previewHighlightIndex : activeHighlightIndex;

  return (
    <>
      {editorExpanded && (
        <div className="fixed inset-0 z-[90] bg-background/98 p-4 backdrop-blur-xl">
          <CodeEditor
            project={project}
            expanded
            onToggleExpand={() => onToggleEditorExpanded(false)}
          />
        </div>
      )}

      <div className={cn("flex min-h-0 flex-1 flex-col", isZenMode && "pt-0")}>
        <PanelGroup
          direction="vertical"
          className="min-h-0 flex-1"
          autoSaveId="openslides-v"
        >
          <Panel
            defaultSize={isZenMode ? 100 : 78}
            minSize={35}
            className="min-h-0"
          >
            <PanelGroup
              direction="horizontal"
              className="h-full min-h-0"
              autoSaveId="openslides-h"
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
                <div className="flex h-full items-center justify-center bg-muted/20 p-4 pb-5">
                  <div className="relative aspect-video h-full max-h-full w-full max-w-full">
                    <SlidePreview
                      project={project}
                      activeHighlightIndex={effectiveHighlight}
                      onHighlightExitComplete={onHighlightExitComplete}
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-2.5 z-40 flex justify-center">
                      <HighlightStepIndicator
                        compact
                        total={activeSlide?.highlights?.length ?? 0}
                        current={effectiveHighlight}
                      />
                    </div>
                  </div>
                </div>
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
                      <div
                        className="flex h-full w-full min-w-[28px] cursor-pointer flex-col items-center justify-center gap-2 border-l border-border/50 bg-card/60 hover:bg-muted/40"
                        onClick={expandCodePanel}
                        title="Expand code editor (or drag the handle)"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            expandCodePanel();
                          }
                        }}
                      >
                        <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
                        <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span
                          className="select-none text-[11px] tracking-wide text-muted-foreground"
                          style={{
                            writingMode: "vertical-rl",
                            textOrientation: "mixed",
                          }}
                        >
                          Code
                        </span>
                      </div>
                    ) : (
                      <CodeEditor
                        project={project}
                        onToggleExpand={() => onToggleEditorExpanded(true)}
                        onCollapse={collapseCodePanel}
                      />
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
                    : slidesPanelSize
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

// We keep editorExpanded local state outside Zustand to avoid persisting it,
// but the trigger lives in layout for simplicity. Parent controls it via props.
