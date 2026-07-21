import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { DroppableProjectCell } from "./DroppableProjectCell";
import { ProjectCard } from "./ProjectCard";
import { StackSpread } from "./StackSpread";
import { StackDeck } from "../ui/stack/StackDeck";
import { chunkConsecutive, type GroupChunk } from "@/lib/grouping";
import { useStackProjects, useUnstackProjects } from "@/hooks/queries/stacks";
import { useAutoDissolveStacks } from "@/hooks/useAutoDissolveStacks";
import type { ProjectSummary } from "@/types";

function useProjectGridColumns() {
  const [columnCount, setColumnCount] = useState(3);
  useEffect(() => {
    const update = () =>
      setColumnCount(
        window.innerWidth < 768 ? 1 : window.innerWidth < 1024 ? 2 : 3,
      );
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return columnCount;
}

interface ProjectGridViewProps {
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
}

export function ProjectGridView({
  projects,
  rename,
  onOpen,
  onDuplicate,
  onExport,
  onDelete,
  duplicateBusy,
  commitBusy,
}: ProjectGridViewProps) {
  const columnCount = useProjectGridColumns();
  const parentRef = useRef<HTMLDivElement>(null);

  const stackProjectsMutation = useStackProjects();
  const unstackProjectsMutation = useUnstackProjects();

  useAutoDissolveStacks(
    projects,
    (p) => p.groupId,
    (p) => p.id,
    unstackProjectsMutation.mutate,
  );

  const chunks = useMemo(() => chunkConsecutive(projects), [projects]);

  const rowVirtualizer = useVirtualizer({
    count: Math.ceil(chunks.length / columnCount),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 220,
    measureElement: (el) => el.getBoundingClientRect().height,
    overscan: 5,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const [activeDragItem, setActiveDragItem] = useState<any>(null);
  const [expandedChunkInfo, setExpandedChunkInfo] = useState<{
    chunk: GroupChunk<ProjectSummary>;
    el: HTMLElement | null;
  } | null>(null);

  // Keep expanded chunk synchronized with latest project data
  const currentExpandedChunk = useMemo(() => {
    if (!expandedChunkInfo) return null;
    const latest = chunks.find(
      (c) =>
        (c.groupId && c.groupId === expandedChunkInfo.chunk.groupId) ||
        (!c.groupId && c.items[0]?.id === expandedChunkInfo.chunk.items[0]?.id)
    );
    if (!latest || latest.items.length <= 1) return null;
    return latest;
  }, [chunks, expandedChunkInfo]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragItem(event.active.data.current || null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragItem(null);
      const { active, over, delta } = event;
      const activeKind = active.data.current?.kind;
      const overKind = over?.data.current?.kind;

      if (activeKind === "fan-item") {
        const project = active.data.current?.project as ProjectSummary;
        if (overKind === "project-cell") {
          const targetChunk = over!.data.current?.chunk as GroupChunk<ProjectSummary>;
          const targetId = targetChunk.items[0].id;
          if (project.id !== targetId) {
            stackProjectsMutation.mutate({ sourceIds: [project.id], targetId });
            if (currentExpandedChunk && currentExpandedChunk.items.length <= 2) {
              setExpandedChunkInfo(null);
            }
          }
        } else if (!over && Math.hypot(delta.x, delta.y) > 120) {
          unstackProjectsMutation.mutate([project.id]);
          if (currentExpandedChunk && currentExpandedChunk.items.length <= 2) {
            setExpandedChunkInfo(null);
          }
        }
      } else if (
        activeKind === "project-cell" &&
        overKind === "project-cell" &&
        active.id !== over?.id
      ) {
        const sourceChunk = active.data.current?.chunk as GroupChunk<ProjectSummary>;
        const targetChunk = over!.data.current?.chunk as GroupChunk<ProjectSummary>;
        const sourceIds = sourceChunk.items.map((p) => p.id);
        const targetId = targetChunk.items[0].id;
        if (!sourceIds.includes(targetId)) {
          stackProjectsMutation.mutate({ sourceIds, targetId });
        }
      }
    },
    [stackProjectsMutation, unstackProjectsMutation, currentExpandedChunk]
  );

  const handleOpenSpread = useCallback(
    (chunk: GroupChunk<ProjectSummary>, el: HTMLElement | null) => {
      setExpandedChunkInfo({ chunk, el });
    },
    []
  );

  if (projects.length === 0) return null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div ref={parentRef} className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl px-6 py-8 pb-12">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Your Presentations</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create beautiful code presentations on your desktop
            </p>
          </div>
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualRows.map((row) => {
              const rowChunks = chunks.slice(
                row.index * columnCount,
                row.index * columnCount + columnCount
              );
              return (
                <div
                  key={row.key}
                  ref={rowVirtualizer.measureElement}
                  data-index={row.index}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${row.size}px`,
                    transform: `translateY(${row.start}px)`,
                  }}
                >
                  <div
                    className="grid gap-4"
                    style={{
                      gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                    }}
                  >
                    {rowChunks.map((chunk) => (
                      <DroppableProjectCell
                        key={chunk.kind === "stack" ? chunk.groupId : chunk.items[0].id}
                        chunk={chunk}
                        isRenaming={(id) => rename.renamingId === id}
                        renameValue={rename.value}
                        onRenameValueChange={rename.setValue}
                        onCommitRename={rename.commit}
                        onCancelRename={rename.cancel}
                        onStartRename={rename.start}
                        onOpen={onOpen}
                        onDuplicate={onDuplicate}
                        onExport={onExport}
                        onDelete={onDelete}
                        duplicateBusy={duplicateBusy}
                        commitBusy={commitBusy}
                        onOpenSpread={handleOpenSpread}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {currentExpandedChunk && (
        <StackSpread
          chunk={currentExpandedChunk}
          deckElement={expandedChunkInfo?.el ?? null}
          onClose={() => setExpandedChunkInfo(null)}
          isRenaming={(id) => rename.renamingId === id}
          renameValue={rename.value}
          onRenameValueChange={rename.setValue}
          onCommitRename={rename.commit}
          onCancelRename={rename.cancel}
          onStartRename={rename.start}
          onOpen={onOpen}
          onDuplicate={onDuplicate}
          onExport={onExport}
          onDelete={onDelete}
          duplicateBusy={duplicateBusy}
          commitBusy={commitBusy}
          onUngroup={(ids) => unstackProjectsMutation.mutate(ids)}
        />
      )}

      <DragOverlay>
        {activeDragItem ? (
          activeDragItem.kind === "fan-item" ? (
            <div className="w-[220px] opacity-90 shadow-2xl scale-105 rotate-2 cursor-grabbing pointer-events-none">
              <ProjectCard
                project={activeDragItem.project}
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
            </div>
          ) : activeDragItem.chunk?.kind === "stack" ? (
            <StackDeck
              count={activeDragItem.chunk.items.length}
              className="w-[220px] opacity-90 shadow-2xl scale-105 rotate-2 cursor-grabbing pointer-events-none"
            >
              <ProjectCard
                project={activeDragItem.chunk.items[0]}
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
            </StackDeck>
          ) : activeDragItem.chunk?.items?.[0] ? (
            <div className="w-[220px] opacity-90 shadow-2xl scale-105 rotate-2 cursor-grabbing pointer-events-none">
              <ProjectCard
                project={activeDragItem.chunk.items[0]}
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
            </div>
          ) : null
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
