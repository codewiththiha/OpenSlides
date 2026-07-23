<script lang="ts">
  import type { Snippet } from "svelte";
  import { Plus, Upload, FolderOpen } from "lucide-svelte";
  import Button from "../ui/Button.svelte";
  import EmptyState from "../ui/EmptyState.svelte";
  import AsyncState from "../states/AsyncState.svelte";

  let {
    isLoading,
    isError,
    error,
    projectCount,
    onCreate,
    onImport,
    showEmptyState = true,
    children,
  }: {
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    projectCount: number;
    onCreate: () => void;
    onImport: () => void;
    /** Hide the default empty prompt while the custom create form is open. */
    showEmptyState?: boolean;
    children?: Snippet;
  } = $props();
</script>

{#if isLoading || isError}
  <AsyncState {isLoading} {isError} {error} loadingLabel="Loading presentations…" />
{:else if projectCount === 0 && showEmptyState}
  <EmptyState
    icon={FolderOpen}
    title="No presentations yet"
    description="Create your first presentation, or import an existing one."
  >
    <Button onclick={onCreate} class="gap-2">
      <Plus class="h-4 w-4" />Create Presentation
    </Button>
    <Button variant="outline" onclick={onImport} class="gap-2">
      <Upload class="h-4 w-4" />Import
    </Button>
  </EmptyState>
{:else}
  {@render children?.()}
{/if}
