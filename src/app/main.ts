import { mount } from "svelte";
import App from "./App.svelte";
import { installAppMenu } from "$lib/lib/app-menu";
import { flushPendingSave } from "$lib/lib/code-save";
import { initInitialTheme } from "$lib/stores/ui-persistence";
import { initBackendConfig } from "$lib/lib/backend-config-loader";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import "../index.css";

// Hydrate the persisted theme before first paint (ui-persistence owns the
// localStorage wire format).
initInitialTheme();
// Prevent Grammarly/LanguageTool/Microsoft Editor from intercepting the document;
// the editor textarea carries the actual spellcheck/autocorrect controls.
document.documentElement.setAttribute("data-gramm", "false");
document.documentElement.setAttribute("data-gramm_editor", "false");
document.documentElement.setAttribute("data-enable-grammarly", "false");

// Native macOS menu bar / Windows window menu
void installAppMenu();
// Backend-owned capabilities/defaults bootstrap once per app session.
void initBackendConfig();

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
