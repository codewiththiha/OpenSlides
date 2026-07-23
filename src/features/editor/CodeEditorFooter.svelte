<script lang="ts">
  import Kbd from "$lib/ui/Kbd.svelte";
  import HighlightSettingsPanel from "@/features/highlights/HighlightSettingsPanel.svelte";
  import SlideTimingSliders from "./SlideTimingSliders.svelte";
  import type { Project, Slide, Highlight } from "$lib/types";

  let {
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
  }: {
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
  } = $props();
</script>

<SlideTimingSliders {project} {slide} />

{#if highlightMode && currentHighlights.length === 0}
  <div class="shrink-0 border-t border-border/50 bg-muted/20 px-3 py-2">
    <p class="text-[10px] leading-relaxed text-muted-foreground">
      Highlight mode is on. Select code, then choose{" "}
      <span class="font-medium text-foreground/80">Add Highlight</span>. During
      the presentation, highlights play in order with{" "}
      <Kbd class="bg-background px-1 text-[9px]">→</Kbd> or a click.
    </p>
  </div>
{/if}

{#if highlightMode || currentHighlights.length > 0}
  <HighlightSettingsPanel
    highlights={currentHighlights}
    {code}
    {expandedId}
    {previewIndex}
    {onToggleExpand}
    {onUpdate}
    {onDelete}
    {onPreview}
    {onMove}
    {onReorder}
  />
{/if}
