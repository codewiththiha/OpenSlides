<script lang="ts">
  /** Project dashboard orchestrator. */
  import { push } from "svelte-spa-router";
  import { Command as CommandIcon, Plus, Upload } from "@lucide/svelte";
  import Button from "$lib/ui/Button.svelte";
  import TitleBar from "$lib/components/TitleBar.svelte";
  import CommandPalette from "$lib/components/CommandPalette.svelte";
  import ShortcutsHelp from "$lib/components/ShortcutsHelp.svelte";
  import CreateDeckTile from "@/features/dashboard/CreateDeckTile.svelte";
  import DashboardStates from "@/features/dashboard/DashboardStates.svelte";
  import ProjectGrid from "@/features/dashboard/ProjectGrid.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import {
    createProjectMutation,
    duplicateProjectMutation,
    deleteProjectMutation,
    exportProjectMutation,
    importProjectMutation,
    renameProjectMutation,
  } from "$lib/queries";
  import { createRenameState } from "$lib/lib/rename-state.svelte";
  import { isModKey, isTypingTarget } from "$lib/lib/keyboard";
  import { modKeyLabel } from "$lib/lib/platform";
  import { setWindowTitle } from "$lib/lib/window-title";
  import {
    subscribeToAppMenu,
    type AppMenuHandlers,
  } from "$lib/lib/app-menu.svelte";
  import {
    ui,
    applyUiTheme,
    setIsCommandOpen,
    setIsShortcutsOpen,
    toggleTheme,
  } from "$lib/stores/ui-state.svelte";
  import { api } from "$lib/lib/tauri-api";
  import { createDashboardState } from "./dashboard-state.svelte";
  import { notify } from "$lib/lib/toast";

  const st = createDashboardState();
  const listQuery = st.query;
  const projects = $derived(st.projects);
  const createMutation = createProjectMutation();
  const duplicateMutation = duplicateProjectMutation();
  const deleteMutation = deleteProjectMutation();
  const exportMutation = exportProjectMutation();
  const importMutation = importProjectMutation();
  const renameMutation = renameProjectMutation();


  // Native + document window title for the dashboard route.
  $effect(() => {
    setWindowTitle("OpenSlides — Presentations");
  });

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
  const handleDelete = (id: string, name: string) => (st.deleteTarget = { id, name });

  function handleConfirmDelete() {
    if (st.deleteTarget) {
      deleteMutation.mutate(st.deleteTarget.id);
      st.deleteTarget = null;
    }
  }

  const rename = createRenameState(async (id: string, name: string) => {
    await renameMutation.mutateAsync({
      projectId: id,
      name: name || "Untitled Presentation",
    });
  });

  async function handleCreate() {
    try {
      const project = await createMutation.mutateAsync(
        st.newName.trim() || "Untitled Presentation",
      );
      if (st.selectedTheme && st.selectedTheme !== "dark-plus" && st.selectedTheme !== project.theme) {
        try {
          await api.updateProjectTheme(project.id, st.selectedTheme);
        } catch {
          // The deck itself exists and is ready to edit even if its optional
          // theme update fails, so do not strand the user on the dashboard.
          notify.error("Presentation created, but the selected theme could not be applied");
        }
      }
      st.resetForm();
      void push(`/editor/${project.id}`);
    } catch {
      // The mutation presents the creation error.
    }
  }

  async function handleImport() {
    try {
      const project = await importMutation.mutateAsync();
      void push(`/editor/${project.id}`);
    } catch {
      /* the mutation owns the error toast */
    }
  }

  const menuHandlers: AppMenuHandlers = {
    "menu://new-project": () => (st.creating = true),
    "menu://open-dashboard": () => void push("/"),
    "menu://command-palette": () => setIsCommandOpen(true),
    "menu://toggle-theme": () => toggleTheme(),
    "menu://shortcuts-app": () => setIsShortcutsOpen(true),
    "menu://shortcuts-help": () => setIsShortcutsOpen(true),
    "menu://export": () => {
      const first = projects[0];
      if (first) exportMutation.mutate(first.id);
    },
  };
  subscribeToAppMenu(() => menuHandlers);

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
      <Button onclick={() => (st.creating = true)} class="gap-2" size="sm">
        <Plus class="h-4 w-4" />New Presentation
      </Button>
    {/snippet}
  </TitleBar>

  {#if st.creating && !listQuery.isLoading && !listQuery.isError}
    <div class="mx-auto max-w-7xl px-6 pt-8">
      <CreateDeckTile
        isExpanded={st.creating || projects.length === 0}
        onToggleExpand={(expanded) => (st.creating = expanded)}
        name={st.newName}
        onNameChange={(v) => (st.newName = v)}
        selectedTheme={st.selectedTheme}
        onThemeChange={(t) => (st.selectedTheme = t)}
        onCreate={() => void handleCreate()}
        isPending={createMutation.isPending}
        isStandalone={true}
      />
    </div>
  {/if}

  <DashboardStates
    isLoading={listQuery.isLoading}
    isError={listQuery.isError}
    error={(listQuery.error as Error | null) ?? null}
    projectCount={projects.length}
    onCreate={() => (st.creating = true)}
    onImport={() => void handleImport()}
    showEmptyState={!st.creating}
  >
    {#if !listQuery.isLoading && !listQuery.isError && projects.length > 0}
      <ProjectGrid
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
    open={st.deleteTarget !== null}
    title="Delete &quot;{st.deleteTarget?.name}&quot;?"
    description="This cannot be undone."
    confirmLabel="Delete"
    destructive
    onConfirm={handleConfirmDelete}
    onCancel={() => (st.deleteTarget = null)}
  />
</div>
