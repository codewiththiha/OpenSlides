<script lang="ts">
  import { untrack } from "svelte";
  import { Timer } from "@lucide/svelte";
  import { formatClockSeconds } from "$lib/lib/utils";
  import Chip from "$lib/ui/Chip.svelte";

  let { duration, resetKey }: { duration: number; resetKey: string } = $props();

  // Initial value only — the effect resets `remaining` whenever
  // duration/resetKey change. untrack() marks the capture as deliberate.
  let remaining = $state(untrack(() => Math.ceil(duration / 1000)));

  $effect(() => {
    duration;
    resetKey;
    const start = performance.now();
    remaining = Math.ceil(duration / 1000);
    const id = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((duration - (performance.now() - start)) / 1000));
      if (next !== remaining) remaining = next;
    }, 100);
    return () => window.clearInterval(id);
  });
</script>

<Chip>
  <Timer class="h-3 w-3" />
  <span class="font-mono tabular-nums">{formatClockSeconds(remaining)}</span>
  <span class="text-white/40">/ {Math.ceil(duration / 1000)}s</span>
</Chip>
