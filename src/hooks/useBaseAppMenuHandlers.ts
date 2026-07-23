import { push } from "svelte-spa-router";
import {
  setIsCommandOpen,
  setIsShortcutsOpen,
  toggleTheme,
} from "$lib/stores/ui-state.svelte";
import type { AppMenuHandlers } from "./useAppMenu.svelte";

interface Options {
  onNewProject?: () => void;
  onExport?: () => void;
}

export function useBaseAppMenuHandlers({
  onNewProject,
  onExport,
}: Options = {}): AppMenuHandlers {
  return {
    "menu://new-project": () => onNewProject?.(),
    "menu://open-dashboard": () => void push("/"),
    "menu://command-palette": () => setIsCommandOpen(true),
    "menu://toggle-theme": () => toggleTheme(),
    "menu://shortcuts-app": () => setIsShortcutsOpen(true),
    "menu://shortcuts-help": () => setIsShortcutsOpen(true),
    "menu://export": () => onExport?.(),
  };
}
