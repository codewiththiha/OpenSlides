import { memo } from "react";
import { useDraggable } from "@dnd-kit/core";
import { useStackDropTarget } from "@/hooks/useStackDropTarget";
import { cn } from "@/lib/utils";
import { type ProjectSummary } from "@/types";
import { type GroupChunk } from "@/lib/grouping";
import { StackDeck } from "../ui/stack/StackDeck";
import { ProjectCard } from "./ProjectCard";

export interface DroppableProjectCellProps {
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
}

export const DroppableProjectCell = memo(function DroppableProjectCell({
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
}: DroppableProjectCellProps) {
  const topProject = chunk.items[0];
  const isStack = chunk.kind === "stack" && chunk.items.length > 1;
  const id = isStack ? chunk.groupId! : topProject.id;

  const { setNodeRef: setDropRef, isOver } = useStackDropTarget(
    `drop-${id}`,
    { kind: "project-cell", chunk },
    false,
  );

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `drag-${id}`,
    data: { kind: "project-cell", chunk },
  });

  const setRefs = (el: HTMLDivElement | null) => {
    setDropRef(el);
    setDragRef(el);
  };

  return (
    <div
      ref={setRefs}
      {...attributes}
      {...listeners}
      data-chunk-id={id}
      className={cn(
        "relative rounded-xl transition-all duration-200",
        isOver && "ring-2 ring-primary ring-offset-2 ring-offset-background bg-primary/10 scale-[1.02] shadow-xl z-20",
        isDragging && "opacity-40 scale-95 pointer-events-none"
      )}
    >
      {isStack ? (
        <StackDeck
          count={chunk.items.length}
          onExpand={() => {
            const el = document.querySelector(`[data-chunk-id="${id}"]`) as HTMLElement | null;
            onOpenSpread(chunk, el);
          }}
          onOpenTop={() => onOpen(topProject.id)}
          ariaLabel={`Stack of ${chunk.items.length} presentations, press Enter to expand`}
        >
          <ProjectCard
            project={topProject}
            isRenaming={isRenaming(topProject.id)}
            renameValue={isRenaming(topProject.id) ? renameValue : ""}
            onRenameValueChange={onRenameValueChange}
            onCommitRename={onCommitRename}
            onCancelRename={onCancelRename}
            onStartRename={onStartRename}
            onOpen={onOpen}
            onDuplicate={onDuplicate}
            onExport={onExport}
            onDelete={onDelete}
            duplicateBusy={duplicateBusy}
            commitBusy={commitBusy}
          />
        </StackDeck>
      ) : (
        <ProjectCard
          project={topProject}
          isRenaming={isRenaming(topProject.id)}
          renameValue={isRenaming(topProject.id) ? renameValue : ""}
          onRenameValueChange={onRenameValueChange}
          onCommitRename={onCommitRename}
          onCancelRename={onCancelRename}
          onStartRename={onStartRename}
          onOpen={onOpen}
          onDuplicate={onDuplicate}
          onExport={onExport}
          onDelete={onDelete}
          duplicateBusy={duplicateBusy}
          commitBusy={commitBusy}
        />
      )}
    </div>
  );
});
