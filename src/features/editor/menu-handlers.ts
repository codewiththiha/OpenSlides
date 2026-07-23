/**
 * Native app-menu handler map for the editor route. Pure wiring — handlers
 * read fresh state from `ui` at fire time, so the map can be created once.
 */
import { push } from "svelte-spa-router";
import {
  ui,
  setIsSettingsOpen,
  setIsCommandOpen,
  setIsShortcutsOpen,
  toggleZenMode,
  toggleTheme,
} from "$lib/stores/ui-state.svelte";
import type { AppMenuHandlers } from "$lib/lib/app-menu.svelte";
import { emitUndo, emitRedo } from "$lib/lib/app-events";

export function createEditorMenuHandlers(args: {
  projectId: () => string | undefined;
  createProject: (name: string) => Promise<{ id: string }>;
  exportProject: (id: string) => void;
  enterPresent: () => void;
  addSlide: () => Promise<unknown> | void;
  duplicateSlide: (id: string) => void;
}): AppMenuHandlers {
  const { projectId, createProject, exportProject, enterPresent, addSlide, duplicateSlide } =
    args;
  return {
    "menu://new-project": () => {
      void createProject("Untitled Presentation").then((p) => {
        void push(`/editor/${p.id}`);
      });
    },
    "menu://open-dashboard": () => void push("/"),
    "menu://export": () => {
      const pid = projectId();
      if (pid) exportProject(pid);
    },
    "menu://present": () => enterPresent(),
    "menu://zen": () => toggleZenMode(),
    "menu://settings": () => setIsSettingsOpen(true),
    "menu://command-palette": () => setIsCommandOpen(true),
    "menu://add-slide": () => {
      if (projectId()) void addSlide();
    },
    "menu://duplicate-slide": () => {
      const pid = projectId();
      if (pid && ui.currentSlideId) duplicateSlide(ui.currentSlideId);
    },
    "menu://toggle-theme": () => toggleTheme(),
    "menu://shortcuts-app": () => setIsShortcutsOpen(true),
    "menu://shortcuts-help": () => setIsShortcutsOpen(true),
    "menu://undo": () => emitUndo(),
    "menu://redo": () => emitRedo(),
  };
}
