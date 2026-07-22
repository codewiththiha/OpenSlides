import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useUiStore } from "@/store/useUiStore";

interface Options {
  onNewProject?: () => void;
  onExport?: () => void;
}

export function useBaseAppMenuHandlers({ onNewProject, onExport }: Options = {}) {
  const navigate = useNavigate();
  return useMemo(
    () => ({
      "menu://new-project": () => onNewProject?.(),
      "menu://open-dashboard": () => navigate("/"),
      "menu://command-palette": () => useUiStore.getState().setIsCommandOpen(true),
      "menu://toggle-theme": () => useUiStore.getState().toggleTheme(),
      "menu://shortcuts-app": () => useUiStore.getState().setIsShortcutsOpen(true),
      "menu://shortcuts-help": () => useUiStore.getState().setIsShortcutsOpen(true),
      "menu://export": () => onExport?.(),
    }),
    [navigate, onNewProject, onExport],
  );
}
