export const SHORTCUTS = {
  commandPalette: { keys: ["mod", "K"], description: "Command palette" },
  shortcutsHelp: { keys: ["?"], description: "Show this shortcuts list" },
  undo: { keys: ["mod", "Z"], description: "Undo code edit" },
  redo: { keys: ["mod", "Shift", "Z"], description: "Redo code edit" },
  zen: { keys: ["mod", "B"], description: "Toggle zen mode" },
  goToSlide: { keys: ["mod", "G"], description: "Go to slide by number or name" },
  focusSlideSearch: { keys: ["mod", "Shift", "F"], description: "Focus slide search (or / when not typing)" },
  present: { keys: ["mod", "Shift", "P"], description: "Start presentation (menu)" },
  newProject: { keys: ["mod", "N"], description: "New project" },
  openDashboard: { keys: ["mod", "Shift", "O"], description: "Go to Dashboard" },
  export: { keys: ["mod", "E"], description: "Export project JSON" },
  settings: { keys: ["mod", ","], description: "Project settings" },
  addSlide: { keys: ["mod", "Shift", "N"], description: "Add slide" },
  duplicateSlide: { keys: ["mod", "Shift", "D"], description: "Duplicate slide" },
} as const;

export type ShortcutKey = keyof typeof SHORTCUTS;

/** Convert a definition into a Tauri menu accelerator string. */
export function shortcutAccelerator(def: { keys: readonly string[] }): string {
  return def.keys.map((k) => (k === "mod" ? "CmdOrCtrl" : k)).join("+");
}
