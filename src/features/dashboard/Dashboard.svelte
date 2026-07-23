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
  import ProjectGridView from "@/features/dashboard/ProjectGridView.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import {
    projectsQuery,
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
  import { getCurrentWindow } from "@tauri-apps/api/window";
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
  import { notify } from "$lib/lib/toast";

  const listQuery = projectsQuery();
  const projects = $derived(listQuery.data ?? []);
  const createMutation = createProjectMutation();
  const duplicateMutation = duplicateProjectMutation();
  const deleteMutation = deleteProjectMutation();
  const exportMutation = exportProjectMutation();
  const importMutation = importProjectMutation();
  const renameMutation = renameProjectMutation();

  let creating = $state(false);
  let newName = $state("Untitled Presentation");
  let selectedTheme = $state("dark-plus");
  let deleteTarget = $state<{ id: string; name: string } | null>(null);

  // Native + document window title for the dashboard route.
  $effect(() => {
    const t = "OpenSlides — Presentations";
    document.title = t;
    getCurrentWindow().setTitle(t).catch(() => undefined);
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
  const handleDelete = (id: string, name: string) => (deleteTarget = { id, name });

  function handleConfirmDelete() {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
      deleteTarget = null;
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

  const menuHandlers: AppMenuHandlers = {
    "menu://new-project": () => (creating = true),
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
      <Button onclick={() => (creating = true)} class="gap-2" size="sm">
        <Plus class="h-4 w-4" />New Presentation
      </Button>
    {/snippet}
  </TitleBar>

  {#if creating && !listQuery.isLoading && !listQuery.isError}
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
    isLoading={listQuery.isLoading}
    isError={listQuery.isError}
    error={(listQuery.error as Error | null) ?? null}
    projectCount={projects.length}
    onCreate={() => (creating = true)}
    onImport={() => void handleImport()}
    showEmptyState={!creating}
  >
    {#if !listQuery.isLoading && !listQuery.isError && projects.length > 0}
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
