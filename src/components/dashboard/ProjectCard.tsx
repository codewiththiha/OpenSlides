import { memo } from "react";
import { ArrowRight, Copy, Download, Pencil, Trash2 } from "lucide-react";
import { Card } from "../ui/card";
import { formatRelative } from "@/lib/utils";
import { themeBackground, type ProjectSummary } from "@/types";
import { ProjectThumb } from "./ProjectThumb";
import { HoverActions, HoverActionButton } from "../ui/hover-actions";
import { InlineEditableText } from "../ui/inline-editable-text";

export const ProjectCard = memo(function ProjectCard({
  project, isRenaming, renameValue, onRenameValueChange, onCommitRename, onCancelRename,
  onStartRename, onOpen, onDuplicate, onExport, onDelete, duplicateBusy, commitBusy,
}: {
  project: ProjectSummary;
  isRenaming: boolean;
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
}) {
  const codeBackground = themeBackground(project.theme);
  const softCodeBackground = `${codeBackground}df`;

  return (
    <Card
      className="group relative h-[180px] cursor-pointer overflow-hidden border-border/70 bg-card p-0 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg"
      onClick={() => { if (!isRenaming) onOpen(project.id); }}
    >
      <ProjectThumb
        project={project}
        fontSize={6}
        className="absolute inset-0 h-full w-full rounded-none border-0"
        codeClassName="p-3 pt-11"
      />

      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 px-3 pb-9 pt-3"
        style={{ background: `linear-gradient(to bottom, ${codeBackground} 0%, ${softCodeBackground} 46%, transparent 100%)` }}
      >
        <div className="pointer-events-auto pr-24 text-white mix-blend-difference">
          {isRenaming ? (
            <InlineEditableText
              value={renameValue}
              onChange={onRenameValueChange}
              onCommit={onCommitRename}
              onCancel={onCancelRename}
              withButtons
              commitBusy={commitBusy}
              className="h-7 text-sm font-semibold"
            />
          ) : (
            <>
              <h3 className="truncate text-base font-semibold leading-tight">{project.name}</h3>
              <p className="mt-1 text-[11px] opacity-75">{project.slideCount} slide{project.slideCount !== 1 ? "s" : ""}</p>
            </>
          )}
        </div>
      </div>

      {!isRenaming && (
        <div className="absolute right-2 top-2 z-20">
          <HoverActions className="gap-0.5 rounded-md bg-black/10 p-0.5 backdrop-blur-sm">
            <HoverActionButton size="md" title="Rename" onClick={(e) => { e.stopPropagation(); onStartRename(project.id, project.name); }}>
              <Pencil className="h-3.5 w-3.5" />
            </HoverActionButton>
            <HoverActionButton size="md" title="Duplicate presentation" onClick={(e) => { e.stopPropagation(); onDuplicate(project.id); }} disabled={duplicateBusy}>
              <Copy className="h-3.5 w-3.5" />
            </HoverActionButton>
            <HoverActionButton size="md" title="Export" onClick={(e) => { e.stopPropagation(); onExport(project.id); }}>
              <Download className="h-3.5 w-3.5" />
            </HoverActionButton>
            <HoverActionButton size="md" destructive title="Delete presentation" onClick={(e) => { e.stopPropagation(); onDelete(project.id, project.name); }}>
              <Trash2 className="h-3.5 w-3.5" />
            </HoverActionButton>
          </HoverActions>
        </div>
      )}

      <div
        className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between px-3 pb-2.5 pt-8 text-white mix-blend-difference"
        style={{ background: `linear-gradient(to top, ${codeBackground} 0%, ${softCodeBackground} 48%, transparent 100%)` }}
      >
        <span className="text-[11px] font-medium opacity-80">{project.theme}</span>
        <span className="flex items-center gap-2 text-[11px] opacity-80">
          Updated {formatRelative(project.updatedAt)}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Card>
  );
});
