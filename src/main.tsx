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
        gap={10}
        offset={16}
        toastOptions={{
          unstyled: true,
          classNames: {
            toast:
              "group toast-openslides relative flex w-[min(380px,calc(100vw-2rem))] items-center gap-3 rounded-xl border bg-card py-3 pl-3.5 pr-10 text-sm text-card-foreground shadow-lg",
            title: "text-sm font-medium leading-snug text-foreground",
            description: "mt-0.5 text-xs leading-snug text-muted-foreground",
            // Content column grows; action sits at the far end
            content: "flex min-w-0 flex-1 flex-col justify-center gap-0.5",
            actionButton:
              "ml-auto shrink-0 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90",
            cancelButton:
              "ml-2 shrink-0 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80",
            // Absolutely positioned so it doesn't skew the flex baseline
            closeButton:
              "toast-close absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md border-0 bg-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
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
