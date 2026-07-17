import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import App from "./App";
import { installAppMenu } from "./lib/app-menu";
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

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        theme="system"
        position="bottom-right"
        closeButton
        toastOptions={{
          unstyled: true,
          classNames: {
            toast:
              "group toast-openslides flex w-[356px] items-start gap-3 rounded-lg border bg-card px-4 py-3 text-sm text-card-foreground shadow-lg",
            title: "font-medium text-foreground",
            description: "text-xs text-muted-foreground",
            actionButton:
              "rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground",
            cancelButton:
              "rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground",
            closeButton:
              "rounded-md border border-border bg-card text-muted-foreground hover:text-foreground",
            success: "toast-success-glow",
            error: "toast-error-glow",
            warning: "toast-warning-glow",
            info: "toast-info-glow",
          },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>,
);
