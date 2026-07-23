<script lang="ts">
  /** Compact editor slide stepper. Navigation side effects stay in CodeEditor. */
  import { ChevronLeft, ChevronRight } from "@lucide/svelte";
  import Button from "$lib/ui/Button.svelte";

  let {
    index,
    total,
    onNavigate,
  }: {
    index: number;
    total: number;
    onNavigate: (direction: -1 | 1) => void;
  } = $props();
</script>

<div class="flex min-w-0 items-center gap-0.5">
  <Button variant="ghost" size="icon" class="h-7 w-7 shrink-0" disabled={index <= 0} onclick={() => onNavigate(-1)}>
    <ChevronLeft class="h-4 w-4" />
  </Button>
  <span class="shrink-0 text-center text-[10px] text-muted-foreground/80">{index + 1}/{total}</span>
  <Button variant="ghost" size="icon" class="h-7 w-7 shrink-0" disabled={index >= total - 1} onclick={() => onNavigate(1)}>
    <ChevronRight class="h-4 w-4" />
  </Button>
</div>
