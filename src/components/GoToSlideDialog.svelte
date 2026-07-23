<script lang="ts">
  /** Cmd/Ctrl+G quick jump to a slide by number or name. */
  import { Command } from "cmdk-sv";
  import { Highlighter as HighlighterIcon } from "lucide-svelte";
  import { ui, setIsGoToSlideOpen, setCurrentSlideId } from "@/store/ui-state.svelte";
  import { slideDisplayName, type Project } from "@/types";
  import { cn } from "@/lib/utils";
  import Kbd from "./ui/Kbd.svelte";
  import CommandDialog from "./ui/CommandDialog.svelte";

  let { project }: { project: Project } = $props();

  let query = $state("");

  $effect(() => {
    if (ui.isGoToSlideOpen) query = "";
  });

  function go(id: string) {
    setCurrentSlideId(id);
    setIsGoToSlideOpen(false);
  }
</script>

<CommandDialog
  open={ui.isGoToSlideOpen}
  onClose={() => setIsGoToSlideOpen(false)}
  label="Go to slide"
  placeholder="Slide number or name…"
  bind:search={query}
  listClassName="max-h-72 overflow-y-auto p-2"
  emptyText="No matching slide."
  class="w-full max-w-md"
>
  <Command.Group class="text-xs text-muted-foreground">
    {#each project.slides as slide, index (slide.id)}
      {@const isCurrent = slide.id === ui.currentSlideId}
      <Command.Item
        value={`${index + 1} ${slideDisplayName(slide, index)}`}
        onSelect={() => go(slide.id)}
        class={cn(
          "flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground",
          "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
          isCurrent && "bg-primary/5",
        )}
      >
        <span class="w-6 shrink-0 text-right font-mono text-[11px] text-muted-foreground">{index + 1}</span>
        <span class="min-w-0 flex-1 truncate">{slideDisplayName(slide, index)}</span>
        {#if slide.highlights.length > 0}
          <span class="flex shrink-0 items-center gap-1 text-[10px] text-amber-400/80">
            <HighlighterIcon class="h-3 w-3" />
            {slide.highlights.length}
          </span>
        {/if}
        <span class="shrink-0 font-mono text-[10px] text-muted-foreground">{(slide.duration / 1000).toFixed(1)}s</span>
      </Command.Item>
    {/each}
  </Command.Group>

  {#snippet footer()}
    <div class="border-t px-3 py-2 text-[10px] text-muted-foreground">
      <Kbd>↵</Kbd> jump · <Kbd>Esc</Kbd> close
    </div>
  {/snippet}
</CommandDialog>
