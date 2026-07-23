<script lang="ts">
  /**
   * Virtualized project grid with pointer-based stack DnD.
   *  - rows: createProjectRowVirtualizer (virtual-rows.svelte.ts)
   *  - drag: projectDnd pointer sessions (8px threshold, rect targets)
   *  - spread: createStackSpreadState (stack-spread-state.svelte.ts)
   *  - one non-interactive overlay clone anchored to the grabbed rect
   */
  import DroppableProjectCell from "./DroppableProjectCell.svelte";
  import ProjectCard from "./ProjectCard.svelte";
  import StackSpread from "./StackSpread.svelte";
  import StackDeck from "$lib/ui/stack/StackDeck.svelte";
  import { chunkConsecutive, type GroupChunk } from "$lib/lib/grouping";
  import {
    stackProjectsMutation,
    unstackProjectsMutation,
  } from "$lib/queries/stacks";
  import { autoDissolveStacks } from "$lib/lib/stacking.svelte";
  import {
    projectDnd,
    setProjectDropHandler,
    type ProjectDragSession,
    type ProjectDragPayload,
  } from "@/features/dashboard/project-dnd.svelte";
  import { createProjectRowVirtualizer } from "./virtual-rows.svelte";
  import { createStackSpreadState } from "./stack-spread-state.svelte";
  import { portal } from "$lib/actions/portal";
  import type { ProjectSummary } from "$lib/types";

  let { projects }: { projects: ProjectSummary[] } = $props();

  const stackMut = stackProjectsMutation();
  const unstackMut = unstackProjectsMutation();

  autoDissolveStacks(
    () => projects,
    (p) => p.groupId,
    (p) => p.id,
    (ids) => unstackMut.mutate(ids),
  );

  const chunks = $derived(chunkConsecutive(projects));

  const grid = createProjectRowVirtualizer({
    rowCount: () => Math.ceil(chunks.length / grid.columnCount),
  });
  const rowVirtualizer = grid.rowVirtualizer;
  const columnCount = $derived(grid.columnCount);
  const virtualRows = $derived($rowVirtualizer.getVirtualItems());
  const totalSize = $derived($rowVirtualizer.getTotalSize());
  const measureRow = grid.measureRow;

  const spread = createStackSpreadState({ chunks: () => chunks });
  const currentExpandedChunk = $derived(spread.currentExpandedChunk);

  function chunkId(chunk: GroupChunk<ProjectSummary>): string {
    return chunk.kind === "stack" && chunk.items.length > 1
      ? chunk.groupId!
      : chunk.items[0].id;
  }

  function sourceIdsOf(payload: ProjectDragPayload): string[] {
    if (payload.kind === "fan-item") return [payload.project.id];
    return payload.chunk.items.map((project) => project.id);
  }

  function handleDrop(session: ProjectDragSession) {
    const targetChunkId = session.hoverChunkId;
    const payload = session.payload;

    // Stack drop: only "drop on cell → stack" exists (no reorder).
    if (targetChunkId) {
      const targetChunk = chunks.find((c) => chunkId(c) === targetChunkId);
      const targetId = targetChunk?.items[0]?.id ?? null;
      const sourceIds = sourceIdsOf(payload);
      const sourceCellId =
        payload.kind === "project-cell" ? chunkId(payload.chunk) : null;
      if (
        targetId &&
        sourceIds.length > 0 &&
        sourceCellId !== targetChunkId &&
        !sourceIds.includes(targetId)
      ) {
        stackMut.mutate({ sourceIds, targetId });
        spread.closeIfNearlyEmpty();
        return;
      }
    }

    // Fan item dragged far away from any cell → unstack it.
    if (payload.kind === "fan-item") {
      const dist = Math.hypot(session.x - session.startX, session.y - session.startY);
      if (dist > 120) {
        unstackMut.mutate([payload.project.id]);
        spread.closeIfNearlyEmpty();
      }
    }
  }

  $effect(() => {
    setProjectDropHandler(handleDrop);
    return () => setProjectDropHandler(null);
  });

  const session = $derived(projectDnd.session);
  const dragWidth = $derived(session?.width ?? null);
</script>

{#snippet overlayCard(project: ProjectSummary)}
  <!-- Non-interactive clone: it never shows rename UI or hover actions. -->
  <ProjectCard {project} static />
{/snippet}

{#if projects.length === 0}
  <!-- nothing (parent shows the empty state) -->
{:else}
  <div bind:this={grid.parentEl} class="flex-1 overflow-auto">
    <div class="mx-auto max-w-7xl px-6 py-8 pb-12">
      <div class="mb-8">
        <h1 class="text-3xl font-bold tracking-tight">Your Presentations</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Create beautiful code presentations on your desktop
        </p>
      </div>
      <div style="height: {totalSize}px; width: 100%; position: relative;">
        {#each virtualRows as row (row.key)}
          <div
            data-index={row.index}
            use:measureRow
            style="position: absolute; top: 0; left: 0; width: 100%; height: {row.size}px; transform: translateY({row.start}px);"
          >
            <div
              class="grid gap-4"
              style="grid-template-columns: repeat({columnCount}, minmax(0, 1fr));"
            >
              {#each chunks.slice(row.index * columnCount, row.index * columnCount + columnCount) as chunk (chunkId(chunk))}
                <DroppableProjectCell
                  {chunk}
                  onOpenSpread={(chunk, el) => spread.open(chunk, el)}
                />
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>

  {#if currentExpandedChunk}
    <StackSpread
      chunk={currentExpandedChunk}
      deckElement={spread.expandedChunkInfo?.el ?? null}
      onClose={() => spread.close()}
      onUngroup={(ids) => unstackMut.mutate(ids)}
    />
  {/if}

  <!-- Drag overlay: non-interactive clone following the pointer -->
  {#if session?.active}
    <div use:portal>
      <div
        class="pointer-events-none fixed rotate-2 cursor-grabbing opacity-90 shadow-2xl"
        style="z-index: 999; left: {session.originLeft + (session.x - session.startX)}px; top: {session.originTop +
          (session.y - session.startY)}px;"
      >
        {#if session.payload.kind === "fan-item"}
          <div style="width: {dragWidth ?? 220}px;">
            {@render overlayCard(session.payload.project)}
          </div>
        {:else if session.payload.chunk.items.length > 1}
          <StackDeck
            count={session.payload.chunk.items.length}
            class="pointer-events-none"
            style="width: {dragWidth ?? undefined}px;"
          >
            {@render overlayCard(session.payload.chunk.items[0])}
          </StackDeck>
        {:else if session.payload.chunk.items[0]}
          <div style="width: {dragWidth ?? undefined}px;">
            {@render overlayCard(session.payload.chunk.items[0])}
          </div>
        {/if}
      </div>
    </div>
  {/if}
{/if}
