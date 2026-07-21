import { memo } from "react";
import { ArrowRight, Copy, Download, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { formatRelative } from "@/lib/utils";
import { type ProjectSummary } from "@/types";
import { ProjectThumb } from "./ProjectThumb";
import { Badge } from "../ui/badge";
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
  return (
    <Card className="group cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg" onClick={() => { if (!isRenaming) onOpen(project.id); }}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <ProjectThumb project={project} />
            <div className="min-w-0 flex-1">
              {isRenaming ? (
                <InlineEditableText
                  value={renameValue}
                  onChange={onRenameValueChange}
                  onCommit={onCommitRename}
                  onCancel={onCancelRename}
                  withButtons
                  commitBusy={commitBusy}
                />
              ) : (
                <>
                  <CardTitle className="truncate text-base font-semibold">{project.name}</CardTitle>
                  <CardDescription className="text-xs">{project.slideCount} slide{project.slideCount !== 1 ? "s" : ""}</CardDescription>
                </>
              )}
            </div>
          </div>
          {!isRenaming && (
            <HoverActions className="gap-1">
              <HoverActionButton size="md" title="Rename" onClick={(e) => { e.stopPropagation(); onStartRename(project.id, project.name); }}>
                <Pencil className="h-3.5 w-3.5" />
              </HoverActionButton>
              <HoverActionButton size="md" title="Duplicate presentation" onClick={(e) => { e.stopPropagation(); onDuplicate(project.id); }} disabled={duplicateBusy}>
                <Copy className="h-4 w-4" />
              </HoverActionButton>
              <HoverActionButton size="md" title="Export" onClick={(e) => { e.stopPropagation(); onExport(project.id); }}>
                <Download className="h-4 w-4" />
              </HoverActionButton>
              <HoverActionButton size="md" destructive onClick={(e) => { e.stopPropagation(); onDelete(project.id, project.name); }}>
                <Trash2 className="h-4 w-4" />
              </HoverActionButton>
            </HoverActions>
          )}
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <Badge variant="muted">{project.theme}</Badge>
      </CardContent>
      <CardFooter className="flex items-center justify-between pt-0">
        <span className="text-xs text-muted-foreground">Updated {formatRelative(project.updatedAt)}</span>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
      </CardFooter>
    </Card>
  );
});
