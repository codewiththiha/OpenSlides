/**
 * App-wide Sonner host. Import once in main.tsx.
 * All toasts use a fixed footprint via `.toast-fixed`.
 */
import { Toaster as SonnerToaster } from "sonner";

export function AppToaster() {
  return (
    <SonnerToaster
      theme="system"
      position="bottom-right"
      closeButton
      gap={12}
      offset={18}
      visibleToasts={5}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group toast-openslides toast-fixed relative flex items-center gap-3 rounded-xl border bg-card text-card-foreground",
          title: "text-[13px] font-medium leading-snug text-foreground",
          description:
            "text-xs leading-snug text-muted-foreground toast-desc-slot",
          content:
            "toast-content flex min-w-0 flex-1 flex-col justify-center gap-0.5",
          actionButton:
            "toast-action ml-auto shrink-0 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90",
          cancelButton:
            "toast-cancel ml-2 shrink-0 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground",
          closeButton:
            "toast-close absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md border-0 bg-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          success: "toast-tone-success toast-glow",
          error: "toast-tone-error toast-glow",
          warning: "toast-tone-warning toast-glow",
          info: "toast-tone-info toast-glow",
        },
      }}
    />
  );
}
