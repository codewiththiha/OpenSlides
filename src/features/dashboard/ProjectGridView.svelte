<script lang="ts">
  /**
   * Virtualized project grid with pointer-based stack DnD.
   *
   * React ran @tanstack/react-virtual rows + a dnd-kit DndContext whose only
   * capability was "drop on cell → stack" (no reorder). The Svelte port:
   *  - @tanstack/svelte-virtual (createVirtualizer store) for the same rows
   *  - projectDnd pointer sessions (8px threshold, rect-intersection targets)
   *  - one DragOverlay-equivalent clone anchored to the grabbed rect
   */
  import { createVirtualizer } from "@tanstack/svelte-virtual";
  import { get } from "svelte/store";
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
  import { portal } from "$lib/actions/portal";
  import type { ProjectSummary } from "$lib/types";

  let {
    projects,
    rename,
    onOpen,
    onDuplicate,
    onExport,
    onDelete,
    duplicateBusy,
    commitBusy,
  }: {
    projects: ProjectSummary[];
    rename: {
      renamingId: string | null;
      value: string;
      setValue: (v: string) => void;
      commit: () => void;
      cancel: () => void;
      start: (id: string, name: string) => void;
    };
    onOpen: (id: string) => void;
    onDuplicate: (id: string) => void;
    onExport: (id: string) => void;
    onDelete: (id: string, name: string) => void;
    duplicateBusy: boolean;
    commitBusy: boolean;
  } = $props();

  /* Responsive columns (media via window width, same breakpoints) */
  let columnCount = $state(3);
  $effect(() => {
    const update = () =>
      (columnCount = window.innerWidth < 768 ? 1 : window.innerWidth < 1024 ? 2 : 3);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  });

  let parentEl = $state<HTMLDivElement | null>(null);

  const stackMut = stackProjectsMutation();
  const unstackMut = unstackProjectsMutation();

  autoDissolveStacks(
    () => projects,
    (p) => p.groupId,
    (p) => p.id,
    (ids) => unstackMut.mutate(ids),
  );

  const chunks = $derived(chunkConsecutive(projects));
  const rowCount = $derived(Math.ceil(chunks.length / columnCount));

  const rowVirtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: 0,
    getScrollElement: () => parentEl,
    estimateSize: () => 220,
    overscan: 5,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  $effect(() => {
    const count = rowCount;
    // The instance is read NON-reactively (get(), not $rowVirtualizer):
    // svelte-virtual's setOptions always ends with a store.set() that marks
    // subscribers dirty (objects are never "equal"), so a tracked read here
    // would re-trigger this very effect forever — Svelte's
    // effect_update_depth_exceeded guard fired and the dashboard froze.
    get(rowVirtualizer).setOptions({
      count,
      getScrollElement: () => parentEl,
      estimateSize: () => 220,
      overscan: 5,
      measureElement: (el: HTMLElement) => el.getBoundingClientRect().height,
    });
  });

  const virtualRows = $derived($rowVirtualizer.getVirtualItems());
  const totalSize = $derived($rowVirtualizer.getTotalSize());

  /** ref={rowVirtualizer.measureElement} as a Svelte action. */
  function measureRow(node: HTMLDivElement) {
    $rowVirtualizer.measureElement(node);
  }

  /* ------------------------- Stack DnD plumbing ------------------------- */
  let expandedChunkInfo = $state<{
    chunk: GroupChunk<ProjectSummary>;
    el: HTMLElement | null;
  } | null>(null);

  function chunkId(chunk: GroupChunk<ProjectSummary>): string {
    return chunk.kind === "stack" && chunk.items.length > 1
      ? chunk.groupId!
      : chunk.items[0].id;
  }

  // Keep expanded chunk synchronized with latest project data
  const currentExpandedChunk = $derived.by(() => {
    const info = expandedChunkInfo;
    if (!info) return null;
    const latest = chunks.find(
      (c) =>
        (c.groupId && c.groupId === info.chunk.groupId) ||
        (!c.groupId && c.items[0]?.id === info.chunk.items[0]?.id),
    );
    if (!latest || latest.items.length <= 1) return null;
    return latest;
  });

  function closeIfNearlyEmpty() {
    if (currentExpandedChunk && currentExpandedChunk.items.length <= 2) {
      expandedChunkInfo = null;
    }
  }

  function sourceIdsOf(payload: ProjectDragPayload): string[] {
    if (payload.kind === "fan-item") return [payload.project.id];
    return payload.chunk.items.map((project) => project.id);
  }

  function handleDrop(session: ProjectDragSession) {
    const targetChunkId = session.hoverChunkId;
    const payload = session.payload;

    // Stack drop (React useStackDragEnd guard semantics)
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
        closeIfNearlyEmpty();
        return;
      }
    }

    // Fan item dragged far away from any cell → unstack it
    if (payload.kind === "fan-item") {
      const dist = Math.hypot(session.x - session.startX, session.y - session.startY);
      if (dist > 120) {
        unstackMut.mutate([payload.project.id]);
        closeIfNearlyEmpty();
      }
    }
  }

  $effect(() => {
    setProjectDropHandler(handleDrop);
    return () => setProjectDropHandler(null);
  });

  function handleOpenSpread(chunk: GroupChunk<ProjectSummary>, el: HTMLElement | null) {
    expandedChunkInfo = { chunk, el };
  }

  const session = $derived(projectDnd.session);
  const dragWidth = $derived(session?.width ?? null);
</script>

{#snippet overlayCard(project: ProjectSummary)}
  <ProjectCard
    {project}
    isRenaming={false}
    renameValue=""
    onRenameValueChange={() => {}}
    onCommitRename={() => {}}
    onCancelRename={() => {}}
    onStartRename={() => {}}
    onOpen={() => {}}
    onDuplicate={() => {}}
    onExport={() => {}}
    onDelete={() => {}}
    duplicateBusy={false}
    commitBusy={false}
  />
{/snippet}

{#if projects.length === 0}
  <!-- nothing (parent shows the empty state) -->
{:else}
  <div bind:this={parentEl} class="flex-1 overflow-auto">
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
                  isRenaming={(pid) => rename.renamingId === pid}
                  renameValue={rename.value}
                  onRenameValueChange={rename.setValue}
                  onCommitRename={rename.commit}
                  onCancelRename={rename.cancel}
                  onStartRename={rename.start}
                  {onOpen}
                  {onDuplicate}
                  {onExport}
                  {onDelete}
                  {duplicateBusy}
                  {commitBusy}
                  onOpenSpread={handleOpenSpread}
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
      deckElement={expandedChunkInfo?.el ?? null}
      onClose={() => (expandedChunkInfo = null)}
      isRenaming={(pid) => rename.renamingId === pid}
      renameValue={rename.value}
      onRenameValueChange={rename.setValue}
      onCommitRename={rename.commit}
      onCancelRename={rename.cancel}
      onStartRename={rename.start}
      {onOpen}
      {onDuplicate}
      {onExport}
      {onDelete}
      {duplicateBusy}
      {commitBusy}
      onUngroup={(ids) => unstackMut.mutate(ids)}
    />
  {/if}

  <!-- DragOverlay equivalent: non-interactive clone following the pointer -->
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
