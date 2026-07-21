import { Plus, Upload, FolderOpen } from "lucide-react";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/empty-state";
import { AsyncState } from "../states/async-state";

interface DashboardStatesProps {
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  projectCount: number;
  onCreate: () => void;
  onImport: () => void;
  children: React.ReactNode;
}

export function DashboardStates({
  isLoading,
  isError,
  error,
  projectCount,
  onCreate,
  onImport,
  children,
}: DashboardStatesProps) {
  if (isLoading || isError) {
    return (
      <AsyncState
        isLoading={isLoading}
        isError={isError}
        error={error}
        loadingLabel="Loading presentations…"
      />
    );
  }

  if (projectCount === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="No presentations yet"
        description="Create your first presentation, or import an existing one."
      >
        <Button onClick={onCreate} className="gap-2">
          <Plus className="h-4 w-4" />Create Presentation
        </Button>
        <Button variant="outline" onClick={onImport} className="gap-2">
          <Upload className="h-4 w-4" />Import
        </Button>
      </EmptyState>
    );
  }

  return <>{children}</>;
}
