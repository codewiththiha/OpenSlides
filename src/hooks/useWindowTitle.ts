import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function useWindowTitle(title: string) {
  useEffect(() => {
    document.title = title;
    getCurrentWindow().setTitle(title).catch(() => undefined);
  }, [title]);
}
