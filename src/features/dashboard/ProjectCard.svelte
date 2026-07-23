<script lang="ts">
  import { ArrowRight, Copy, Download, Pencil, Trash2 } from "@lucide/svelte";
  import Card from "$lib/ui/Card.svelte";
  import { formatRelative } from "$lib/lib/utils";
  import { type ProjectSummary } from "$lib/types";
  import { createCodeCardTheme } from "$lib/ui/code-card/code-card-theme.svelte";
  import { PROJECT_CARD_HEIGHT } from "./layout";
  import ProjectThumb from "./ProjectThumb.svelte";
  import HoverActions from "$lib/ui/HoverActions.svelte";
  import HoverActionButton from "$lib/ui/HoverActionButton.svelte";
  import InlineEditableText from "$lib/ui/InlineEditableText.svelte";

  let {
    project,
    isRenaming,
    renameValue,
    onRenameValueChange,
    onCommitRename,
    onCancelRename,
    onStartRename,
    onOpen,
    onDuplicate,
    onExport,
    onDelete,
    duplicateBusy,
    commitBusy,
  }: {
    project: ProjectSummary;
    isRenaming: boolean;
    renameValue: string;
    onRenameValueChange: (value: string) => void;
    onCommitRename: () => void;
    onCancelRename: () => void;
    onStartRename: (id: string, name: string) => void;
    onOpen: (id: string) => void;
    onDuplicate: (id: string) => void;
    onExport: (id: string) => void;
    onDelete: (id: string, name: string) => void;
    duplicateBusy: boolean;
    commitBusy: boolean;
  } = $props();

  const cardTheme = createCodeCardTheme(() => project.theme);
</script>

<Card
  class="group relative cursor-pointer select-none overflow-hidden border-border/70 bg-card p-0 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  style="height: {PROJECT_CARD_HEIGHT}px"
  role="button"
  tabindex={0}
  aria-label={project.name}
  onclick={() => {
    if (!isRenaming) onOpen(project.id);
  }}
  onkeydown={(e) => {
    if (isRenaming) return;
    // Inner controls (rename input, hover buttons) handle their own keys;
    // only activate when the card itself is focused.
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(project.id);
    }
  }}
>
  <ProjectThumb
    {project}
    fontSize={6}
    class="absolute inset-0 h-full w-full rounded-none border-0"
    codeClassName="p-3 pt-11"
  />

  <div
    class="pointer-events-none absolute inset-x-0 top-0 z-10 px-3 pb-9 pt-3"
    style="background: {cardTheme.topGradient};"
  >
    <div class="pointer-events-auto pr-24 text-white mix-blend-difference">
      {#if isRenaming}
        <InlineEditableText
          value={renameValue}
          onChange={onRenameValueChange}
          onCommit={onCommitRename}
          onCancel={onCancelRename}
          withButtons
          {commitBusy}
          class="h-7 text-sm font-semibold"
        />
      {:else}
        <h3 class="truncate text-base font-semibold leading-tight">{project.name}</h3>
        <p class="mt-1 text-[11px] opacity-75">
          {project.slideCount} slide{project.slideCount !== 1 ? "s" : ""}
        </p>
      {/if}
    </div>
  </div>

  {#if !isRenaming}
    <div class="absolute right-2 top-2 z-20">
      <HoverActions class="gap-0.5 rounded-md bg-black/10 p-0.5 backdrop-blur-sm">
        <HoverActionButton
          size="md"
          title="Rename"
          onclick={(e) => {
            e.stopPropagation();
            onStartRename(project.id, project.name);
          }}
        >
          <Pencil class="h-3.5 w-3.5" />
        </HoverActionButton>
        <HoverActionButton
          size="md"
          title="Duplicate presentation"
          onclick={(e) => {
            e.stopPropagation();
            onDuplicate(project.id);
          }}
          disabled={duplicateBusy}
        >
          <Copy class="h-3.5 w-3.5" />
        </HoverActionButton>
        <HoverActionButton
          size="md"
          title="Export"
          onclick={(e) => {
            e.stopPropagation();
            onExport(project.id);
          }}
        >
          <Download class="h-3.5 w-3.5" />
        </HoverActionButton>
        <HoverActionButton
          size="md"
          destructive
          title="Delete presentation"
          onclick={(e) => {
            e.stopPropagation();
            onDelete(project.id, project.name);
          }}
        >
          <Trash2 class="h-3.5 w-3.5" />
        </HoverActionButton>
      </HoverActions>
    </div>
  {/if}

  <div
    class="absolute inset-x-0 bottom-0 z-10 px-3 pb-2.5 pt-9"
    style="background: {cardTheme.bottomGradient};"
  >
    <div class="flex items-center justify-between text-white mix-blend-difference">
      <span class="text-[11px] font-medium opacity-80">{project.theme}</span>
      <span class="flex items-center gap-2 text-[11px] opacity-80">
        Updated {formatRelative(project.updatedAt)}
        <ArrowRight class="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
      </span>
    </div>
  </div>
</Card>
