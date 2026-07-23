<script lang="ts">
  /**
   * Dashboard grid cell: pointer-drag source + stack drop target.
   * (React combined useDraggable + useStackDropTarget here; the Svelte
   * version starts a project-dnd session on pointerdown and renders the
   * hover ring from the session's rect-intersection result.)
   */
  import { cn } from "@/lib/utils";
  import { type ProjectSummary } from "@/types";
  import { type GroupChunk } from "@/lib/grouping";
  import StackDeck from "../ui/stack/StackDeck.svelte";
  import ProjectCard from "./ProjectCard.svelte";
  import { beginProjectDrag, projectDnd } from "@/lib/project-dnd.svelte";

  let {
    chunk,
    isRenaming,
    renameValue,
    onRenameValueChange,
    onCommitRename,
    onCancelRename,
    onStartRename,
    onOpen,
    onDuplicate,
    onExport,
    onDelete,
    duplicateBusy,
    commitBusy,
    onOpenSpread,
  }: {
    chunk: GroupChunk<ProjectSummary>;
    isRenaming: (id: string) => boolean;
    renameValue: string;
    onRenameValueChange: (value: string) => void;
    onCommitRename: () => void;
    onCancelRename: () => void;
    onStartRename: (id: string, name: string) => void;
    onOpen: (id: string) => void;
    onDuplicate: (id: string) => void;
    onExport: (id: string) => void;
    onDelete: (id: string, name: string) => void;
    duplicateBusy: boolean;
    commitBusy: boolean;
    onOpenSpread: (chunk: GroupChunk<ProjectSummary>, el: HTMLElement | null) => void;
  } = $props();

  const topProject = $derived(chunk.items[0]);
  const isStack = $derived(chunk.kind === "stack" && chunk.items.length > 1);
  const id = $derived(isStack ? chunk.groupId! : topProject.id);

  let cellEl = $state<HTMLDivElement | null>(null);

  const session = $derived(projectDnd.session);
  const isSelfDragging = $derived(
    Boolean(
      session?.active &&
        session.payload.kind === "project-cell" &&
        String(
          session.payload.chunk.kind === "stack" && session.payload.chunk.items.length > 1
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
  class={cn(
    "relative touch-pan-y rounded-xl transition-all duration-200",
    isSelfDragging && "pointer-events-none scale-95 opacity-40",
    isHovered &&
      "z-20 scale-[1.02] bg-primary/10 shadow-xl ring-2 ring-primary ring-offset-2 ring-offset-background",
  )}
>
  {#if isStack}
    <StackDeck
      count={chunk.items.length}
      onExpand={() => onOpenSpread(chunk, cellEl)}
      onOpenTop={() => onOpen(topProject.id)}
      ariaLabel="Stack of {chunk.items.length} presentations, press Enter to expand"
    >
      <ProjectCard
        project={topProject}
        isRenaming={isRenaming(topProject.id)}
        renameValue={isRenaming(topProject.id) ? renameValue : ""}
        {onRenameValueChange}
        {onCommitRename}
        {onCancelRename}
        {onStartRename}
        {onOpen}
        {onDuplicate}
        {onExport}
        {onDelete}
        {duplicateBusy}
        {commitBusy}
      />
    </StackDeck>
  {:else}
    <ProjectCard
      project={topProject}
      isRenaming={isRenaming(topProject.id)}
      renameValue={isRenaming(topProject.id) ? renameValue : ""}
      {onRenameValueChange}
      {onCommitRename}
      {onCancelRename}
      {onStartRename}
      {onOpen}
      {onDuplicate}
      {onExport}
      {onDelete}
      {duplicateBusy}
      {commitBusy}
    />
  {/if}
</div>
