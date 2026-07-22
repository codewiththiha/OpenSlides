/** Project dashboard orchestrator with virtualized project rows. */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Command as CommandIcon, Plus, Upload } from "lucide-react";
import { Button } from "./ui/button";
import { TitleBar } from "./TitleBar";
import { CommandPalette } from "./CommandPalette";
import { ShortcutsHelp } from "./ShortcutsHelp";
import { CreateDeckTile } from "./dashboard/CreateDeckTile";
import { DashboardStates } from "./dashboard/DashboardStates";
import { ProjectGridView } from "./dashboard/ProjectGridView";
import { ConfirmDialog } from "./ui/confirm-dialog";
import { useProjects, useCreateProject, useDuplicateProject, useDeleteProject, useExportProject, useImportProject, useRenameProject } from "@/hooks/queries";
import { useInlineRename } from "@/hooks/useInlineRename";
import { useWindowTitle } from "@/hooks/useWindowTitle";
import { useBaseAppMenuHandlers } from "@/hooks/useBaseAppMenuHandlers";
import { isModKey, isTypingTarget } from "@/lib/keyboard";
import { modKeyLabel } from "@/lib/platform";
import { useAppMenu } from "@/hooks/useAppMenu";
import { applyUiTheme, useUiStore } from "@/store/useUiStore";
import { api } from "@/lib/tauri-api";
import { notify } from "@/lib/toast";

export function Dashboard() {
  const navigate = useNavigate();
  const { data: projects = [], isLoading, isError, error } = useProjects();
  const createMutation = useCreateProject();
  const duplicateMutation = useDuplicateProject();
  const deleteMutation = useDeleteProject();
  const exportMutation = useExportProject();
  const importMutation = useImportProject();
  const renameMutation = useRenameProject();
  const createRef = useRef(createMutation); const duplicateRef = useRef(duplicateMutation); const deleteRef = useRef(deleteMutation); const exportRef = useRef(exportMutation); const importRef = useRef(importMutation); const renameRef = useRef(renameMutation); const projectsRef = useRef(projects);
  createRef.current = createMutation; duplicateRef.current = duplicateMutation; deleteRef.current = deleteMutation; exportRef.current = exportMutation; importRef.current = importMutation; renameRef.current = renameMutation; projectsRef.current = projects;
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("Untitled Presentation");
  const [selectedTheme, setSelectedTheme] = useState("dark-plus");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const setIsCommandOpen = useUiStore((s) => s.setIsCommandOpen); const isDarkUi = useUiStore((s) => s.isDarkUi);
  useWindowTitle("OpenSlides — Presentations");
  useEffect(() => { applyUiTheme(isDarkUi); }, [isDarkUi]);
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === "?" && !isTypingTarget(e.target) && !isModKey(e)) { e.preventDefault(); useUiStore.getState().setIsShortcutsOpen(true); } }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, []);
  const handleOpen = useCallback((id: string) => navigate(`/editor/${id}`), [navigate]);
  const handleDuplicate = useCallback((id: string) => duplicateRef.current.mutate(id), []);
  const handleExport = useCallback((id: string) => exportRef.current.mutate(id), []);
  const handleDelete = useCallback((id: string, name: string) => { setDeleteTarget({ id, name }); }, []);
  const handleConfirmDelete = useCallback(() => {
    if (deleteTarget) { deleteRef.current.mutate(deleteTarget.id); setDeleteTarget(null); }
  }, [deleteTarget]);
  const rename = useInlineRename(useCallback(async (id: string, name: string) => { await renameRef.current.mutateAsync({ projectId: id, name: name || "Untitled Presentation" }); }, []));
  const handleCreate = useCallback(async () => {
    try {
      const project = await createRef.current.mutateAsync(newName.trim() || "Untitled Presentation");
      if (selectedTheme && selectedTheme !== "dark-plus" && selectedTheme !== project.theme) {
        try {
          await api.updateProjectTheme(project.id, selectedTheme);
        } catch {
          // The deck itself exists and is ready to edit even if its optional
          // theme update fails, so do not strand the user on the dashboard.
          notify.error("Presentation created, but the selected theme could not be applied");
        }
      }
      setCreating(false);
      setNewName("Untitled Presentation");
      setSelectedTheme("dark-plus");
      navigate(`/editor/${project.id}`);
    } catch {
      // The mutation hook presents the creation error.
    }
  }, [newName, selectedTheme, navigate]);
  const handleImport = useCallback(async () => { try { const project = await importRef.current.mutateAsync(); navigate(`/editor/${project.id}`); } catch {} }, [navigate]);
  const menuHandlers = useBaseAppMenuHandlers({
    onNewProject: () => setCreating(true),
    onExport: () => {
      const first = projectsRef.current[0];
      if (first) exportRef.current.mutate(first.id);
    },
  });
  useAppMenu(menuHandlers);
  const mod = modKeyLabel();
  return <div className="flex h-full flex-col bg-background"><TitleBar leading={<div className="flex items-center gap-2"><img src="/openslides-logo.svg" alt="OpenSlides" className="h-8 w-8 rounded-lg object-cover" /><span className="text-sm font-semibold">OpenSlides</span></div>} trailing={<><Button variant="ghost" size="icon" className="h-8 w-8" title={`Command palette (${mod}K)`} onClick={() => setIsCommandOpen(true)}><CommandIcon className="h-3.5 w-3.5" /></Button><Button variant="outline" size="sm" className="gap-1.5" onClick={() => void handleImport()} disabled={importMutation.isPending}><Upload className="h-4 w-4" />Import</Button><Button onClick={() => setCreating(true)} className="gap-2" size="sm"><Plus className="h-4 w-4" />New Presentation</Button></>} />
  {creating && !isLoading && !isError && (
    <div className="mx-auto max-w-7xl px-6 pt-8">
      <CreateDeckTile
        isExpanded={creating || projects.length === 0}
        onToggleExpand={(expanded) => setCreating(expanded)}
        name={newName}
        onNameChange={setNewName}
        selectedTheme={selectedTheme}
        onThemeChange={setSelectedTheme}
        onCreate={() => void handleCreate()}
        isPending={createMutation.isPending}
        isStandalone={true}
      />
    </div>
  )}
  <DashboardStates
    isLoading={isLoading}
    isError={isError}
    error={error as Error | null}
    projectCount={projects.length}
    onCreate={() => setCreating(true)}
    onImport={() => void handleImport()}
    showEmptyState={!creating}
  >
    {!isLoading && !isError && projects.length > 0 && (
      <ProjectGridView
        projects={projects}
        rename={{
          renamingId: rename.renamingId,
          value: rename.value,
          setValue: rename.setValue,
          commit: rename.commit,
          cancel: rename.cancel,
          start: rename.start,
        }}
        onOpen={handleOpen}
        onDuplicate={handleDuplicate}
        onExport={handleExport}
        onDelete={handleDelete}
        duplicateBusy={duplicateMutation.isPending}
        commitBusy={renameMutation.isPending}
      />
    )}
  </DashboardStates>
  <CommandPalette />
  <ShortcutsHelp />
  <ConfirmDialog
    open={deleteTarget !== null}
    title={`Delete "${deleteTarget?.name}"?`}
    description="This cannot be undone."
    confirmLabel="Delete"
    destructive
    onConfirm={handleConfirmDelete}
    onCancel={() => setDeleteTarget(null)}
  />
  </div>;
}
