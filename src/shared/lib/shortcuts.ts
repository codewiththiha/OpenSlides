export const SHORTCUTS = {
  commandPalette: { keys: ["mod", "K"], description: "Command palette" },
  shortcutsHelp: { keys: ["?"], description: "Show keyboard shortcuts" },
  undo: { keys: ["mod", "Z"], description: "Undo code edit" },
  redo: { keys: ["mod", "Shift", "Z"], description: "Redo code edit" },
  zen: { keys: ["mod", "B"], description: "Toggle focus mode" },
  goToSlide: {
    keys: ["mod", "G"],
    description: "Go to slide by number or name",
  },
  focusSlideSearch: { keys: ["mod", "F"], description: "Open search" },
  present: {
    keys: ["mod", "Shift", "P"],
    description: "Start presentation (menu)",
  },
  newProject: { keys: ["mod", "N"], description: "New presentation" },
  openDashboard: {
    keys: ["mod", "Shift", "O"],
    description: "Go to Dashboard",
  },
  export: { keys: ["mod", "E"], description: "Export presentation" },
  settings: { keys: ["mod", ","], description: "Presentation settings" },
  addSlide: { keys: ["mod", "Shift", "N"], description: "Add slide" },
  duplicateSlide: {
    keys: ["mod", "Shift", "D"],
    description: "Duplicate slide",
  },
} as const;

/** Convert a definition into a Tauri menu accelerator string. */
export function shortcutAccelerator(def: { keys: readonly string[] }): string {
  return def.keys.map((k) => (k === "mod" ? "CmdOrCtrl" : k)).join("+");
}
