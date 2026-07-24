<script lang="ts">
  import { Loader2, AlertCircle } from "@lucide/svelte";
  import type { SaveStatus } from "$lib/stores/types";

  let { status }: { status: SaveStatus } = $props();
</script>

{#if status === "saving"}
  <span class="flex items-center gap-1 text-[11px] text-muted-foreground">
    <Loader2 class="h-3 w-3 animate-spin" /> Saving…
  </span>
{:else if status === "error"}
  <span class="flex items-center gap-1 text-[11px] text-destructive">
    <AlertCircle class="h-3 w-3" /> Save failed
  </span>
{/if}
