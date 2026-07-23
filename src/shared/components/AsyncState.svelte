<script lang="ts">
  import { Loader2 } from "@lucide/svelte";
  import type { Snippet } from "svelte";

  let {
    isLoading,
    isError,
    error = null,
    loadingLabel = "Loading…",
    errorAction,
    children,
  }: {
    isLoading: boolean;
    isError: boolean;
    error?: Error | null;
    loadingLabel?: string;
    errorAction?: Snippet;
    children?: Snippet;
  } = $props();
</script>

{#if isLoading}
  <div
    class="flex flex-1 items-center justify-center gap-2 text-muted-foreground"
  >
    <Loader2 class="h-5 w-5 animate-spin" />
    {loadingLabel}
  </div>
{:else if isError}
  <div class="flex flex-1 flex-col items-center justify-center gap-3">
    <p class="text-destructive">
      {error?.message ?? "Something went wrong"}
    </p>
    {@render errorAction?.()}
  </div>
{:else}
  {@render children?.()}
{/if}
