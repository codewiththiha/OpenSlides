<script lang="ts">
  import { ChevronDown, ChevronUp, Search, X } from "lucide-svelte";
  import Button from "../ui/Button.svelte";
  import type { FindReplaceApi } from "@/hooks/useFindReplace.svelte";

  let { fr, onClose }: { fr: FindReplaceApi; onClose: () => void } = $props();

  let findInput = $state<HTMLInputElement | null>(null);

  // autoFocus equivalent
  $effect(() => {
    findInput?.focus();
  });

  function onFindKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) fr.goPrev();
      else fr.goNext();
    }
    if (e.key === "Escape") onClose();
  }
</script>

<div class="flex shrink-0 flex-wrap items-center gap-2 border-b bg-muted/30 px-2 py-1.5">
  <div class="flex items-center gap-1">
    <Search class="h-3 w-3 text-muted-foreground" />
    <input
      bind:this={findInput}
      class="h-6 w-32 rounded border border-input bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring sm:w-48"
      placeholder="Find"
      value={fr.searchTerm}
      oninput={(e) => (fr.searchTerm = e.currentTarget.value)}
      onkeydown={onFindKeyDown}
    />
    <span class="text-[10px] text-muted-foreground">
      {fr.matches.length ? `${fr.currentMatchIndex + 1}/${fr.matches.length}` : "0/0"}
    </span>
    <Button variant="ghost" size="icon" class="h-6 w-6" onclick={fr.goPrev} title="Previous (Shift+Enter)">
      <ChevronUp class="h-3 w-3" />
    </Button>
    <Button variant="ghost" size="icon" class="h-6 w-6" onclick={fr.goNext} title="Next (Enter)">
      <ChevronDown class="h-3 w-3" />
    </Button>
  </div>
  <div class="flex items-center gap-1">
    <input
      class="h-6 w-32 rounded border border-input bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring sm:w-48"
      placeholder="Replace"
      value={fr.replaceTerm}
      oninput={(e) => (fr.replaceTerm = e.currentTarget.value)}
    />
    <Button variant="ghost" size="sm" class="h-6 text-xs" onclick={fr.replaceCurrent} disabled={!fr.matches.length}>
      Replace
    </Button>
    <Button variant="ghost" size="sm" class="h-6 text-xs" onclick={fr.replaceAll} disabled={!fr.matches.length}>
      Replace All
    </Button>
    <label class="flex items-center gap-1 text-[10px] text-muted-foreground">
      <input
        type="checkbox"
        checked={fr.matchCase}
        onchange={(e) => (fr.matchCase = e.currentTarget.checked)}
        class="h-3 w-3"
      />Aa
    </label>
  </div>
  <Button variant="ghost" size="icon" class="ml-auto h-6 w-6" onclick={onClose}>
    <X class="h-3 w-3" />
  </Button>
</div>
