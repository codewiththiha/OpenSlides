<script lang="ts">
  /** Project dashboard orchestrator. */
  import { Command as CommandIcon, Plus, Upload } from "@lucide/svelte";
  import Button from "$lib/ui/Button.svelte";
  import TitleBar from "$lib/components/TitleBar.svelte";
  import CommandPalette from "$lib/components/CommandPalette.svelte";
  import ShortcutsHelp from "$lib/components/ShortcutsHelp.svelte";
  import CreateDeckTile from "@/features/dashboard/CreateDeckTile.svelte";
  import DashboardStates from "@/features/dashboard/DashboardStates.svelte";
  import ProjectGrid from "@/features/dashboard/ProjectGrid.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import { createRenameState } from "$lib/lib/rename-state.svelte";
  import { isModKey, isTypingTarget } from "$lib/lib/keyboard";
  import { modKeyLabel } from "$lib/lib/platform";
  import { setWindowTitle } from "$lib/lib/window-title";
  import {
    ui,
    applyUiTheme,
    setIsCommandOpen,
    setIsShortcutsOpen,
  } from "$lib/stores/ui-state.svelte";
  import { createDashboardState } from "./dashboard-state.svelte";
  import {
    createDashboardActions,
    installDashboardMenu,
  } from "./dashboard-actions";
  import { provideProjectCardActions } from "./project-card-actions.svelte";

  const st = createDashboardState();
  const listQuery = st.query;
  const projects = $derived(st.projects);
  const actions = createDashboardActions(st);

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

  const rename = createRenameState(async (id: string, name: string) => {
    await actions.renameMutation.mutateAsync({
      projectId: id,
      name: name || "Untitled Presentation",
    });
  });

  // Card actions live in context so ProjectCard consumers (grid cells, fan
  // overlay, drag clone) don't thread a dozen callbacks through each level.
  provideProjectCardActions({
    get renamingId() {
      return rename.renamingId;
    },
    get renameValue() {
      return rename.value;
    },
    get duplicateBusy() {
      return actions.duplicateMutation.isPending;
    },
    get commitBusy() {
      return actions.renameMutation.isPending;
    },
    setRenameValue: (v: string) => (rename.value = v),
    commitRename: rename.commit,
    cancelRename: rename.cancel,
    startRename: rename.start,
    open: actions.open,
    duplicate: actions.duplicate,
    exportProject: actions.exportProject,
    remove: actions.requestDelete,
  });

  installDashboardMenu(st, actions);

  const mod = modKeyLabel();
</script>

<div class="flex h-full flex-col bg-background">
  <TitleBar>
    {#snippet leading()}
      <div class="flex items-center gap-2">
        <img
          src="/openslides-logo.svg"
          alt="OpenSlides"
          class="h-8 w-8 rounded-lg object-cover"
        />
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
        onclick={() => void actions.importProject()}
        disabled={actions.importMutation.isPending}
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
        onCreate={() => void actions.create()}
        isPending={actions.createMutation.isPending}
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
    onImport={() => void actions.importProject()}
    showEmptyState={!st.creating}
  >
    {#if !listQuery.isLoading && !listQuery.isError && projects.length > 0}
      <ProjectGrid {projects} />
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
    onConfirm={actions.confirmDelete}
    onCancel={() => (st.deleteTarget = null)}
  />
</div>
