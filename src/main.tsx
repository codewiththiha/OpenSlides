import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { AppToaster } from "./components/ui/toaster";
import { installAppMenu } from "./lib/app-menu";
import { flushPendingSave } from "./lib/save-flush";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Default to dark UI chrome (Zustand persist may override on hydrate)
document.documentElement.classList.add("dark");
// Globally disable spellcheck to prevent macOS NSSpellServer timeouts
// WKWebView spell server attempts to generate candidates for selected ranges
// and times out on large code blocks — we disable at every level.
document.documentElement.setAttribute("spellcheck", "false");
(document.documentElement as any).spellcheck = false;
try {
  // body may not exist yet during module eval, guard
  document.body?.setAttribute("spellcheck", "false");
} catch {}
// Also prevent Grammarly/LanguageTool/Microsoft Editor from hooking
document.documentElement.setAttribute("data-gramm", "false");
document.documentElement.setAttribute("data-gramm_editor", "false");
document.documentElement.setAttribute("data-enable-grammarly", "false");

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

// Native macOS menu bar / Windows-Linux window menu
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

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <AppToaster />
    </QueryClientProvider>
  </React.StrictMode>,
);
