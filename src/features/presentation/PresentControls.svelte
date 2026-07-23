<script lang="ts">
  import { Pause, Play } from "@lucide/svelte";
  import Kbd from "$lib/ui/Kbd.svelte";

  let {
    isAutoPlaying,
    onToggleAutoplay,
    onExit,
  }: {
    isAutoPlaying: boolean;
    onToggleAutoplay: () => void;
    onExit: () => void;
  } = $props();
</script>

<button
  type="button"
  class="flex items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 text-sm text-white/70 transition hover:bg-white/20 hover:text-white"
  onclick={onToggleAutoplay}
  title={isAutoPlaying ? "Pause autoplay" : "Play (auto-advance)"}
>
  {#if isAutoPlaying}
    <Pause class="h-3.5 w-3.5" />
  {:else}
    <Play class="h-3.5 w-3.5" />
  {/if}
  <span class="hidden sm:inline">
    {isAutoPlaying ? "Pause" : "Play"}
  </span>
</button>
<button
  type="button"
  class="flex items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 text-sm text-white/70 transition hover:bg-white/20 hover:text-white"
  onclick={onExit}
>
  Press{" "}
  <Kbd tone="onDark" class="px-2 text-xs">ESC</Kbd>
  {" "}to exit
</button>
