<script lang="ts">
  /**
   * EditorLayout — resizable preview + code + slides rail.
   * Owns paneforge handles, collapsible logic, and the panel rune slice.
   * HighlightStepIndicator is clickable via onSelectHighlight.
   */
  import { Pane, PaneGroup, PaneResizer } from "paneforge";
  import { Code2 } from "@lucide/svelte";
  import CodeEditor from "@/features/editor/CodeEditor.svelte";
  import BottomSlidesPanel from "@/features/slides/BottomSlidesPanel.svelte";
  import RenderBoundary from "$lib/components/RenderBoundary.svelte";
  import PreviewPane from "./PreviewPane.svelte";
  import CollapsedPanelButton from "$lib/ui/CollapsedPanelButton.svelte";
  import {
    ui,
    setIsBottomPanelCollapsed,
    setIsCodePanelCollapsed,
    setCodePanelSize,
    setSlidesPanelSize,
  } from "$lib/stores/ui-state.svelte";
  import {
    useCollapsiblePanel,
    type PaneHandle,
  } from "@/hooks/useCollapsiblePanel.svelte";
  import { cn } from "$lib/lib/utils";
  import type { Project, Slide } from "$lib/types";
  import { Z_INDEX } from "$lib/ui/Overlay.svelte";

  const CODE_COLLAPSE_THRESHOLD = 14;
  const SLIDES_MIN_EXPANDED_SIZE = 14;
  const SLIDES_COLLAPSE_THRESHOLD = SLIDES_MIN_EXPANDED_SIZE;
  const CODE_COLLAPSED_SIZE = 3.5;
  const SLIDES_COLLAPSED_SIZE = 6;

  let {
    project,
    activeSlide,
    activeHighlightIndex,
    previewHighlightIndex,
    onHighlightExitComplete,
    onSelectHighlight,
    editorExpanded,
    onToggleEditorExpanded,
  }: {
    project: Project;
    activeSlide?: Slide;
    activeHighlightIndex: number;
    previewHighlightIndex: number;
    onHighlightExitComplete: () => void;
    onSelectHighlight: (index: number) => boolean;
    editorExpanded: boolean;
    onToggleEditorExpanded: (v: boolean) => void;
  } = $props();

  let codePane = $state<PaneHandle | null>(null);
  let slidesPane = $state<PaneHandle | null>(null);

  const isZenMode = $derived(ui.isZenMode);
  const isBottomPanelCollapsed = $derived(ui.isBottomPanelCollapsed);
  const isCodePanelCollapsed = $derived(ui.isCodePanelCollapsed);

  // Older saved layouts may be smaller; never restore an expanded slides rail
  // below the space required for a complete centered card.
  const slidesExpandedSize = $derived(
    Math.max(SLIDES_MIN_EXPANDED_SIZE, ui.slidesPanelSize),
  );

  const {
    expand: expandCodePanel,
    collapse: collapseCodePanel,
    onResize: onCodePanelResize,
  } = useCollapsiblePanel({
    panel: () => codePane,
    isCollapsed: () => ui.isCodePanelCollapsed,
    setCollapsed: setIsCodePanelCollapsed,
    size: () => ui.codePanelSize,
    setSize: setCodePanelSize,
    collapseThreshold: CODE_COLLAPSE_THRESHOLD,
  });

  const { onResize: onSlidesPanelResize } = useCollapsiblePanel({
    panel: () => slidesPane,
    isCollapsed: () => ui.isBottomPanelCollapsed,
    setCollapsed: setIsBottomPanelCollapsed,
    size: () => slidesExpandedSize,
    setSize: setSlidesPanelSize,
    collapseThreshold: SLIDES_COLLAPSE_THRESHOLD,
  });

  // Resolve effective highlight index (preview override)
  const effectiveHighlight = $derived(
    previewHighlightIndex >= 0 ? previewHighlightIndex : activeHighlightIndex,
  );
</script>

{#if editorExpanded}
  <div
    class="fixed inset-0 bg-background/98 p-4 backdrop-blur-xl"
    style="z-index: {Z_INDEX.editorExpanded}"
  >
    {#key `expanded-editor-${project.id}`}
      <RenderBoundary>
        <CodeEditor
          {project}
          expanded
          onToggleExpand={() => onToggleEditorExpanded(false)}
        />
      </RenderBoundary>
    {/key}
  </div>
{/if}

<div class={cn("flex min-h-0 flex-1 flex-col", isZenMode && "pt-0")}>
  <PaneGroup direction="vertical" class="min-h-0 flex-1">
    <Pane defaultSize={isZenMode ? 100 : 78} minSize={35} class="min-h-0">
      <PaneGroup direction="horizontal" class="h-full min-h-0">
        <Pane
          defaultSize={isCodePanelCollapsed
            ? 100 - CODE_COLLAPSED_SIZE
            : 100 - ui.codePanelSize}
          minSize={30}
          class="min-w-0"
        >
          <PreviewPane
            {project}
            {activeSlide}
            {effectiveHighlight}
            {onHighlightExitComplete}
            {onSelectHighlight}
          />
        </Pane>

        {#if !isZenMode}
          <PaneResizer
            class={cn(
              "w-1.5 bg-border/60 transition-colors hover:bg-primary/50 data-active:bg-primary/60",
              isCodePanelCollapsed && "w-1.5 hover:bg-primary/60",
            )}
          />

          <Pane
            bind:this={codePane}
            defaultSize={isCodePanelCollapsed ? CODE_COLLAPSED_SIZE : ui.codePanelSize}
            minSize={18}
            maxSize={70}
            collapsible
            collapsedSize={CODE_COLLAPSED_SIZE}
            class="min-w-0"
            onResize={onCodePanelResize}
            onCollapse={() => setIsCodePanelCollapsed(true)}
            onExpand={() => setIsCodePanelCollapsed(false)}
          >
            {#if isCodePanelCollapsed}
              <CollapsedPanelButton
                orientation="vertical"
                icon={Code2}
                label="Code"
                onClick={expandCodePanel}
                title="Expand code editor (or drag the handle)"
              />
            {:else}
              {#key `editor-${project.id}`}
                <RenderBoundary>
                  <CodeEditor
                    {project}
                    onToggleExpand={() => onToggleEditorExpanded(true)}
                    onCollapse={collapseCodePanel}
                  />
                </RenderBoundary>
              {/key}
            {/if}
          </Pane>
        {/if}
      </PaneGroup>
    </Pane>

    {#if !isZenMode}
      <PaneResizer
        class={cn(
          "h-1.5 bg-border/60 transition-colors hover:bg-primary/50 data-active:bg-primary/60",
          isBottomPanelCollapsed && "h-1.5",
        )}
      />
      <Pane
        bind:this={slidesPane}
        defaultSize={isBottomPanelCollapsed ? SLIDES_COLLAPSED_SIZE : slidesExpandedSize}
        minSize={SLIDES_MIN_EXPANDED_SIZE}
        maxSize={28}
        collapsible
        collapsedSize={SLIDES_COLLAPSED_SIZE}
        class="min-h-0"
        onResize={onSlidesPanelResize}
        onCollapse={() => setIsBottomPanelCollapsed(true)}
        onExpand={() => setIsBottomPanelCollapsed(false)}
      >
        <BottomSlidesPanel
          {project}
          collapsed={isBottomPanelCollapsed}
          {activeHighlightIndex}
        />
      </Pane>
    {/if}
  </PaneGroup>
</div>
