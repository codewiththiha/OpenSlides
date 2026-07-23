<script lang="ts">
  /**
   * Dashboard grid cell: pointer-drag source + stack drop target.
   * Starts a project-dnd session on pointerdown and renders the hover ring
   * from the session's rect-intersection result.
   */
  import { cn } from "$lib/lib/utils";
  import { type ProjectSummary } from "$lib/types";
  import { type GroupChunk } from "$lib/lib/grouping";
  import StackDeck from "$lib/ui/stack/StackDeck.svelte";
  import ProjectCard from "./ProjectCard.svelte";
  import {
    beginProjectDrag,
    projectDnd,
  } from "@/features/dashboard/project-dnd.svelte";
  import { consumeProjectCardActions } from "./project-card-actions.svelte";

  let {
    chunk,
    onOpenSpread,
  }: {
    chunk: GroupChunk<ProjectSummary>;
    onOpenSpread: (
      chunk: GroupChunk<ProjectSummary>,
      el: HTMLElement | null,
    ) => void;
  } = $props();

  const cardActions = consumeProjectCardActions();

  const topProject = $derived(chunk.items[0]!);
  const isStack = $derived(chunk.kind === "stack" && chunk.items.length > 1);
  const id = $derived(isStack ? chunk.groupId! : topProject.id);

  let cellEl = $state<HTMLDivElement | null>(null);

  const session = $derived(projectDnd.session);
  const isSelfDragging = $derived(
    Boolean(
      session?.active &&
      session.payload.kind === "project-cell" &&
      String(
        session.payload.chunk.kind === "stack" &&
          session.payload.chunk.items.length > 1
          ? session.payload.chunk.groupId
          : session.payload.chunk.items[0]?.id,
      ) === id,
    ),
  );
  const isHovered = $derived(
    Boolean(session?.active && !isSelfDragging && session.hoverChunkId === id),
  );

  function onPointerDown(e: PointerEvent) {
    const rect = cellEl?.getBoundingClientRect();
    beginProjectDrag({ kind: "project-cell", chunk }, e, {
      width: rect?.width ?? null,
      originLeft: rect?.left ?? e.clientX,
      originTop: rect?.top ?? e.clientY,
    });
  }
</script>

<div
  bind:this={cellEl}
  data-chunk-id={id}
  onpointerdown={onPointerDown}
  role="presentation"
  class={cn(
    "relative touch-pan-y rounded-xl transition-all duration-200 select-none",
    isSelfDragging && "pointer-events-none scale-95 opacity-40",
    isHovered &&
      "z-20 scale-[1.02] bg-primary/10 shadow-xl ring-2 ring-primary ring-offset-2 ring-offset-background",
  )}
>
  {#if isStack}
    <StackDeck
      count={chunk.items.length}
      onExpand={() => onOpenSpread(chunk, cellEl)}
      onOpenTop={() => cardActions.open(topProject.id)}
      ariaLabel="Stack of {chunk.items
        .length} presentations, press Enter to expand"
    >
      <ProjectCard project={topProject} />
    </StackDeck>
  {:else}
    <ProjectCard project={topProject} />
  {/if}
</div>
