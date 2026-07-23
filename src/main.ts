import { mount } from "svelte";
import App from "./App.svelte";
import { installAppMenu } from "./lib/app-menu";
import { flushPendingSave } from "./lib/code-save";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import "./index.css";

// Default to dark UI chrome (persisted UI state may override below)
document.documentElement.classList.add("dark");
// Prevent Grammarly/LanguageTool/Microsoft Editor from hooking the document;
// the editor textarea carries the actual spellcheck/autocorrect controls.
document.documentElement.setAttribute("data-gramm", "false");
document.documentElement.setAttribute("data-gramm_editor", "false");
document.documentElement.setAttribute("data-enable-grammarly", "false");

// Hydrate the persisted theme before first paint (was zustand persist; now
// the same localStorage wire format is read by ui-state.svelte.ts).
try {
  const raw = localStorage.getItem("openslides-ui");
  if (raw) {
    const parsed = JSON.parse(raw) as { state?: { isDarkUi?: boolean } };
    if (parsed.state?.isDarkUi === false) {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    }
  }
} catch {
  /* ignore */
}

// Native macOS menu bar / Windows window menu
void installAppMenu();

// Quit handshake: Rust intercepts window close / Cmd+Q and asks us to flush
// the pending debounced slide-code save before letting the process die
// (it force-exits after ~4s even if this never resolves, so quit can't hang).
void listen("app://quit-request", async () => {
  await flushPendingSave();
  await invoke("finish_quit");
});

// Belt-and-braces for the browser/dev context: fire the pending write on
// unload too (the IPC goes out immediately; the write usually lands in ms).
window.addEventListener("beforeunload", () => {
  void flushPendingSave();
});

const app = mount(App, {
  target: document.getElementById("app") as HTMLElement,
});

export default app;
