import { Loader2 } from "lucide-react";

interface AsyncStateProps {
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  loadingLabel?: string;
  errorAction?: React.ReactNode;
  children?: React.ReactNode;
}

export function AsyncState({
  isLoading,
  isError,
  error,
  loadingLabel = "Loading…",
  errorAction,
  children,
}: AsyncStateProps) {
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        {loadingLabel}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <p className="text-destructive">
          {error?.message ?? "Something went wrong"}
        </p>
        {errorAction}
      </div>
    );
  }

  return <>{children}</>;
}
