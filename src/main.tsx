import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { AppToaster } from "./components/ui/toaster";
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
      <AppToaster />
    </QueryClientProvider>
  </React.StrictMode>,
);
