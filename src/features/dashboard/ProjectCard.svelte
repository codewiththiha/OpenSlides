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

  import { consumeProjectCardActions } from "./project-card-actions.svelte";

  let {
    project,
    static: isStatic = false,
  }: {
    project: ProjectSummary;
    /** Drag-clone mode: hides rename UI and hover actions, no activation. */
    static?: boolean;
  } = $props();

  const cardActions = consumeProjectCardActions();

  const isRenaming = $derived(
    !isStatic && cardActions.renamingId === project.id,
  );
  const renameValue = $derived(isRenaming ? cardActions.renameValue : "");

  const cardTheme = createCodeCardTheme(() => project.theme);
</script>

<Card
  class="group relative cursor-pointer overflow-hidden border-border/70 bg-card p-0 transition-all duration-200 select-none hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
  style="height: {PROJECT_CARD_HEIGHT}px"
  role={isStatic ? undefined : "button"}
  tabindex={isStatic ? undefined : 0}
  aria-label={isStatic ? undefined : project.name}
  onclick={() => {
    if (!isStatic && !isRenaming) cardActions.open(project.id);
  }}
  onkeydown={(e) => {
    if (isStatic || isRenaming) return;
    // Inner controls (rename input, hover buttons) handle their own keys;
    // only activate when the card itself is focused.
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      cardActions.open(project.id);
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
    class="pointer-events-none absolute inset-x-0 top-0 z-10 px-3 pt-3 pb-9"
    style="background: {cardTheme.topGradient};"
  >
    <div class="pointer-events-auto pr-24 text-white mix-blend-difference">
      {#if isRenaming}
        <InlineEditableText
          value={renameValue}
          onChange={cardActions.setRenameValue}
          onCommit={cardActions.commitRename}
          onCancel={cardActions.cancelRename}
          withButtons
          commitBusy={cardActions.commitBusy}
          class="h-7 text-sm font-semibold"
        />
      {:else}
        <h3 class="truncate text-base leading-tight font-semibold">
          {project.name}
        </h3>
        <p class="mt-1 text-[11px] opacity-75">
          {project.slideCount} slide{project.slideCount !== 1 ? "s" : ""}
        </p>
      {/if}
    </div>
  </div>

  {#if !isRenaming && !isStatic}
    <div class="absolute top-2 right-2 z-20">
      <HoverActions
        class="gap-0.5 rounded-md bg-black/10 p-0.5 backdrop-blur-sm"
      >
        <HoverActionButton
          size="md"
          title="Rename"
          onclick={(e) => {
            e.stopPropagation();
            cardActions.startRename(project.id, project.name);
          }}
        >
          <Pencil class="h-3.5 w-3.5" />
        </HoverActionButton>
        <HoverActionButton
          size="md"
          title="Duplicate presentation"
          onclick={(e) => {
            e.stopPropagation();
            cardActions.duplicate(project.id);
          }}
          disabled={cardActions.duplicateBusy}
        >
          <Copy class="h-3.5 w-3.5" />
        </HoverActionButton>
        <HoverActionButton
          size="md"
          title="Export"
          onclick={(e) => {
            e.stopPropagation();
            cardActions.exportProject(project.id);
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
            cardActions.remove(project.id, project.name);
          }}
        >
          <Trash2 class="h-3.5 w-3.5" />
        </HoverActionButton>
      </HoverActions>
    </div>
  {/if}

  <div
    class="absolute inset-x-0 bottom-0 z-10 px-3 pt-9 pb-2.5"
    style="background: {cardTheme.bottomGradient};"
  >
    <div
      class="flex items-center justify-between text-white mix-blend-difference"
    >
      <span class="text-[11px] font-medium opacity-80">{project.theme}</span>
      <span class="flex items-center gap-2 text-[11px] opacity-80">
        Updated {formatRelative(project.updatedAt)}
        <ArrowRight
          class="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"
        />
      </span>
    </div>
  </div>
</Card>
