import { useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ProjectCard } from "./ProjectCard";
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
  const rowVirtualizer = useVirtualizer({
    count: Math.ceil(projects.length / columnCount),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 220,
    measureElement: (el) => el.getBoundingClientRect().height,
    overscan: 5,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  if (projects.length === 0) return null;

  return (
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
            const rowProjects = projects.slice(
              row.index * columnCount,
              row.index * columnCount + columnCount,
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
                  {rowProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      isRenaming={rename.renamingId === project.id}
                      renameValue={
                        rename.renamingId === project.id ? rename.value : ""
                      }
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
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
