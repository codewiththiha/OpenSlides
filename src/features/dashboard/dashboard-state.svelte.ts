/**
 * Dashboard route state: project list query + the create-dialog form and
 * delete-confirmation target.
 */
import { projectsQuery } from "$lib/queries";

export function createDashboardState() {
  const query = projectsQuery();
  const projects = $derived(query.data ?? []);

  let creating = $state(false);
  let newName = $state("Untitled Presentation");
  let selectedTheme = $state("dark-plus");
  let deleteTarget = $state<{ id: string; name: string } | null>(null);

  function resetForm() {
    creating = false;
    newName = "Untitled Presentation";
    selectedTheme = "dark-plus";
  }

  return {
    query,
    get projects() {
      return projects;
    },
    get creating() {
      return creating;
    },
    set creating(v: boolean) {
      creating = v;
    },
    get newName() {
      return newName;
    },
    set newName(v: string) {
      newName = v;
    },
    get selectedTheme() {
      return selectedTheme;
    },
    set selectedTheme(v: string) {
      selectedTheme = v;
    },
    get deleteTarget() {
      return deleteTarget;
    },
    set deleteTarget(v: { id: string; name: string } | null) {
      deleteTarget = v;
    },
    resetForm,
  };
}
