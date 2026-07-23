<script lang="ts">
  /**
   * Virtualized project grid with pointer-based stack DnD.
   *  - rows: createProjectRowVirtualizer (virtual-rows.svelte.ts)
   *  - drag: projectDnd pointer sessions (8px threshold, rect targets)
   *  - spread: createStackSpreadState (stack-spread-state.svelte.ts)
   *  - one non-interactive overlay clone anchored to the grabbed rect
   */
  import DroppableProjectCell from "./DroppableProjectCell.svelte";
  import ProjectDragOverlay from "./ProjectDragOverlay.svelte";
  import StackSpread from "./StackSpread.svelte";
  import { chunkConsecutive } from "$lib/lib/grouping";
  import {
    stackProjectsMutation,
    unstackProjectsMutation,
  } from "$lib/queries/stacks";
  import { autoDissolveStacks } from "$lib/lib/stacking.svelte";
  import {
    setProjectDropHandler,
    type ProjectDragSession,
  } from "@/features/dashboard/project-dnd.svelte";
  import { chunkIdOf, decideProjectDrop } from "./project-drop";
  import { createProjectRowVirtualizer } from "./virtual-rows.svelte";
  import { createStackSpreadState } from "./stack-spread-state.svelte";
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

  function handleDrop(session: ProjectDragSession) {
    const decision = decideProjectDrop(session, chunks);
    if (decision.kind === "stack") {
      stackMut.mutate({ sourceIds: decision.sourceIds, targetId: decision.targetId });
      spread.closeIfNearlyEmpty();
      return;
    }
    if (decision.kind === "unstack") {
      unstackMut.mutate([decision.projectId]);
      spread.closeIfNearlyEmpty();
    }
  }

  $effect(() => {
    setProjectDropHandler(handleDrop);
    return () => setProjectDropHandler(null);
  });
</script>

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
              {#each chunks.slice(row.index * columnCount, row.index * columnCount + columnCount) as chunk (chunkIdOf(chunk))}
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

  <ProjectDragOverlay />

{/if}
