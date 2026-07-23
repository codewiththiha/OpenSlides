/**
 * Dashboard mutations, handlers and native-menu wiring (§6.8). The
 * component keeps layout + effects; every mutation and cross-feature
 * handler is created here so they stay in one testable place.
 */
import { push } from "svelte-spa-router";
import {
  createProjectMutation,
  duplicateProjectMutation,
  deleteProjectMutation,
  exportProjectMutation,
  importProjectMutation,
  renameProjectMutation,
} from "$lib/queries";
import { api } from "$lib/lib/tauri-api";
import { notify } from "$lib/lib/toast";
import {
  setIsCommandOpen,
  setIsShortcutsOpen,
  toggleTheme,
} from "$lib/stores/ui-state.svelte";
import {
  subscribeToAppMenu,
  type AppMenuHandlers,
} from "$lib/lib/app-menu.svelte";
import type { createDashboardState } from "./dashboard-state.svelte";

export function createDashboardActions(
  st: ReturnType<typeof createDashboardState>,
) {
  const createMutation = createProjectMutation();
  const duplicateMutation = duplicateProjectMutation();
  const deleteMutation = deleteProjectMutation();
  const exportMutation = exportProjectMutation();
  const importMutation = importProjectMutation();
  const renameMutation = renameProjectMutation();

  const open = (id: string) => void push(`/editor/${id}`);
  const duplicate = (id: string) => duplicateMutation.mutate(id);
  const exportProject = (id: string) => exportMutation.mutate(id);
  const requestDelete = (id: string, name: string) =>
    (st.deleteTarget = { id, name });

  function confirmDelete() {
    if (st.deleteTarget) {
      deleteMutation.mutate(st.deleteTarget.id);
      st.deleteTarget = null;
    }
  }

  async function create() {
    try {
      const project = await createMutation.mutateAsync(
        st.newName.trim() || "Untitled Presentation",
      );
      if (
        st.selectedTheme &&
        st.selectedTheme !== "dark-plus" &&
        st.selectedTheme !== project.theme
      ) {
        try {
          await api.updateProjectTheme(project.id, st.selectedTheme);
        } catch {
          // The deck itself exists and is ready to edit even if its optional
          // theme update fails, so do not strand the user on the dashboard.
          notify.error(
            "Presentation created, but the selected theme could not be applied",
          );
        }
      }
      st.resetForm();
      void push(`/editor/${project.id}`);
    } catch {
      // The mutation presents the creation error.
    }
  }

  async function importProject() {
    try {
      const project = await importMutation.mutateAsync();
      void push(`/editor/${project.id}`);
    } catch {
      /* the mutation owns the error toast */
    }
  }

  return {
    createMutation,
    duplicateMutation,
    exportMutation,
    importMutation,
    renameMutation,
    open,
    duplicate,
    exportProject,
    requestDelete,
    confirmDelete,
    create,
    importProject,
  };
}

/** Native menu bar wiring for the dashboard route. */
export function installDashboardMenu(
  st: ReturnType<typeof createDashboardState>,
  actions: ReturnType<typeof createDashboardActions>,
): void {
  const handlers: AppMenuHandlers = {
    "menu://new-project": () => (st.creating = true),
    "menu://open-dashboard": () => void push("/"),
    "menu://command-palette": () => setIsCommandOpen(true),
    "menu://toggle-theme": () => toggleTheme(),
    "menu://shortcuts-app": () => setIsShortcutsOpen(true),
    "menu://shortcuts-help": () => setIsShortcutsOpen(true),
    "menu://export": () => {
      const first = st.projects[0];
      if (first) actions.exportMutation.mutate(first.id);
    },
  };
  subscribeToAppMenu(() => handlers);
}
