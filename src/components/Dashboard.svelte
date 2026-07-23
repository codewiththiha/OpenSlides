<script lang="ts">
  /** Project dashboard orchestrator. */
  import { push } from "svelte-spa-router";
  import { Command as CommandIcon, Plus, Upload } from "lucide-svelte";
  import Button from "./ui/Button.svelte";
  import TitleBar from "./TitleBar.svelte";
  import CommandPalette from "./CommandPalette.svelte";
  import ShortcutsHelp from "./ShortcutsHelp.svelte";
  import CreateDeckTile from "./dashboard/CreateDeckTile.svelte";
  import DashboardStates from "./dashboard/DashboardStates.svelte";
  import ProjectGridView from "./dashboard/ProjectGridView.svelte";
  import ConfirmDialog from "./ui/ConfirmDialog.svelte";
  import {
    useProjects,
    useCreateProject,
    useDuplicateProject,
    useDeleteProject,
    useExportProject,
    useImportProject,
    useRenameProject,
  } from "@/queries";
  import { useInlineRename } from "@/hooks/useInlineRename.svelte";
  import { useWindowTitle } from "@/hooks/useWindowTitle.svelte";
  import { useBaseAppMenuHandlers } from "@/hooks/useBaseAppMenuHandlers";
  import { isModKey, isTypingTarget } from "@/lib/keyboard";
  import { modKeyLabel } from "@/lib/platform";
  import { useAppMenu } from "@/hooks/useAppMenu.svelte";
  import {
    ui,
    applyUiTheme,
    setIsCommandOpen,
    setIsShortcutsOpen,
  } from "@/store/ui-state.svelte";
  import { api } from "@/lib/tauri-api";
  import { notify } from "@/lib/toast";

  const projectsQuery = useProjects();
  const projects = $derived(projectsQuery.data ?? []);
  const createMutation = useCreateProject();
  const duplicateMutation = useDuplicateProject();
  const deleteMutation = useDeleteProject();
  const exportMutation = useExportProject();
  const importMutation = useImportProject();
  const renameMutation = useRenameProject();

  let creating = $state(false);
  let newName = $state("Untitled Presentation");
  let selectedTheme = $state("dark-plus");
  let deleteTarget = $state<{ id: string; name: string } | null>(null);

  useWindowTitle(() => "OpenSlides — Presentations");

  $effect(() => {
    applyUiTheme(ui.isDarkUi);
  });

  $effect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "?" && !isTypingTarget(e.target) && !isModKey(e)) {
        e.preventDefault();
        setIsShortcutsOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const handleOpen = (id: string) => void push(`/editor/${id}`);
  const handleDuplicate = (id: string) => duplicateMutation.mutate(id);
  const handleExport = (id: string) => exportMutation.mutate(id);
  const handleDelete = (id: string, name: string) => (deleteTarget = { id, name });

  function handleConfirmDelete() {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
      deleteTarget = null;
    }
  }

  const rename = useInlineRename(async (id: string, name: string) => {
    await renameMutation.mutateAsync({
      projectId: id,
      name: name || "Untitled Presentation",
    });
  });

  async function handleCreate() {
    try {
      const project = await createMutation.mutateAsync(
        newName.trim() || "Untitled Presentation",
      );
      if (selectedTheme && selectedTheme !== "dark-plus" && selectedTheme !== project.theme) {
        try {
          await api.updateProjectTheme(project.id, selectedTheme);
        } catch {
          // The deck itself exists and is ready to edit even if its optional
          // theme update fails, so do not strand the user on the dashboard.
          notify.error("Presentation created, but the selected theme could not be applied");
        }
      }
      creating = false;
      newName = "Untitled Presentation";
      selectedTheme = "dark-plus";
      void push(`/editor/${project.id}`);
    } catch {
      // The mutation hook presents the creation error.
    }
  }

  async function handleImport() {
    try {
      const project = await importMutation.mutateAsync();
      void push(`/editor/${project.id}`);
    } catch {
      /* mutation hook owns the error toast */
    }
  }

  const menuHandlers = useBaseAppMenuHandlers({
    onNewProject: () => (creating = true),
    onExport: () => {
      const first = projects[0];
      if (first) exportMutation.mutate(first.id);
    },
  });
  useAppMenu(() => menuHandlers);

  const mod = modKeyLabel();
</script>

<div class="flex h-full flex-col bg-background">
  <TitleBar>
    {#snippet leading()}
      <div class="flex items-center gap-2">
        <img src="/openslides-logo.svg" alt="OpenSlides" class="h-8 w-8 rounded-lg object-cover" />
        <span class="text-sm font-semibold">OpenSlides</span>
      </div>
    {/snippet}
    {#snippet trailing()}
      <Button
        variant="ghost"
        size="icon"
        class="h-8 w-8"
        title="Command palette ({mod}K)"
        onclick={() => setIsCommandOpen(true)}
      >
        <CommandIcon class="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        class="gap-1.5"
        onclick={() => void handleImport()}
        disabled={importMutation.isPending}
      >
        <Upload class="h-4 w-4" />Import
      </Button>
      <Button onclick={() => (creating = true)} class="gap-2" size="sm">
        <Plus class="h-4 w-4" />New Presentation
      </Button>
    {/snippet}
  </TitleBar>

  {#if creating && !projectsQuery.isLoading && !projectsQuery.isError}
    <div class="mx-auto max-w-7xl px-6 pt-8">
      <CreateDeckTile
        isExpanded={creating || projects.length === 0}
        onToggleExpand={(expanded) => (creating = expanded)}
        name={newName}
        onNameChange={(v) => (newName = v)}
        {selectedTheme}
        onThemeChange={(t) => (selectedTheme = t)}
        onCreate={() => void handleCreate()}
        isPending={createMutation.isPending}
        isStandalone={true}
      />
    </div>
  {/if}

  <DashboardStates
    isLoading={projectsQuery.isLoading}
    isError={projectsQuery.isError}
    error={(projectsQuery.error as Error | null) ?? null}
    projectCount={projects.length}
    onCreate={() => (creating = true)}
    onImport={() => void handleImport()}
    showEmptyState={!creating}
  >
    {#if !projectsQuery.isLoading && !projectsQuery.isError && projects.length > 0}
      <ProjectGridView
        {projects}
        rename={{
          renamingId: rename.renamingId,
          value: rename.value,
          setValue: (v) => (rename.value = v),
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
    {/if}
  </DashboardStates>

  <CommandPalette />
  <ShortcutsHelp />
  <ConfirmDialog
    open={deleteTarget !== null}
    title="Delete &quot;{deleteTarget?.name}&quot;?"
    description="This cannot be undone."
    confirmLabel="Delete"
    destructive
    onConfirm={handleConfirmDelete}
    onCancel={() => (deleteTarget = null)}
  />
</div>
