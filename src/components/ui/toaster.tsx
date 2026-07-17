/**
 * App-wide Sonner host. Import once in main.tsx.
 * Visual system is driven by `.toast-openslides` CSS + `notify` helpers.
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
            "group toast-openslides toast-size-md relative flex w-[min(400px,calc(100vw-2rem))] items-center gap-3 rounded-xl border bg-card py-3.5 pl-4 pr-11 text-sm text-card-foreground shadow-lg",
          title: "text-[13px] font-medium leading-snug text-foreground",
          description: "mt-0.5 text-xs leading-snug text-muted-foreground",
          content: "flex min-w-0 flex-1 flex-col justify-center gap-0.5",
          actionButton:
            "toast-action ml-auto shrink-0 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90",
          cancelButton:
            "toast-cancel ml-2 shrink-0 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80",
          closeButton:
            "toast-close absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md border-0 bg-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          // tone classes applied via notify() className; keep these as fallbacks
          success: "toast-tone-success toast-glow",
          error: "toast-tone-error toast-glow",
          warning: "toast-tone-warning toast-glow",
          info: "toast-tone-info toast-glow",
        },
      }}
    />
  );
}
