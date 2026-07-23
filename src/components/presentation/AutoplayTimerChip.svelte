<script lang="ts">
  import { Timer } from "lucide-svelte";
  import { formatClockSeconds } from "@/lib/utils";
  import Chip from "../ui/Chip.svelte";

  let { duration, resetKey }: { duration: number; resetKey: string } = $props();

  let remaining = $state(Math.ceil(duration / 1000));

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
