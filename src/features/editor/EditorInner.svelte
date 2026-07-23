<script lang="ts">
  /**
   * EditorInner — orchestrator, no longer a God component.
   *
   * Delegates to:
   *  - EditorToolbar (TitleBar + save badge + slide name + actions)
   *  - EditorLayout (resizable preview/code/slides)
   *  - PresentOverlay (fullscreen stage)
   *  - createEditorState (route query + title/selection lifecycle effects)
   *  - createEditorKeyboard / createEditorMenuHandlers
   *  - createPresentFullscreen, createHighlightNav, createCurrentSlide
   *  - ui-state runes for cross-route UI state
   *
   * The keyed route remount resets editor UI on project switch; the
   * initial-slide effect in createEditorState immediately re-selects
   * `settings.currentSlideId ?? slides[0]`.
   */
  import { untrack } from "svelte";
  import { push } from "svelte-spa-router";
  import {
    ui,
    setCurrentSlideId,
    setIsSettingsOpen,
    setIsAutoPlaying,
    toggleZenMode,
  } from "$lib/stores/ui-state.svelte";
  import { createCurrentSlide } from "@/features/slides/current-slide.svelte";
  import Button from "$lib/ui/Button.svelte";
  import TitleBar from "$lib/components/TitleBar.svelte";
  import SettingsDrawer from "@/features/settings/SettingsDrawer.svelte";
  import AsyncState from "$lib/components/AsyncState.svelte";
  import CommandPalette from "$lib/components/CommandPalette.svelte";
  import ShortcutsHelp from "$lib/components/ShortcutsHelp.svelte";
  import EditorToolbar from "./EditorToolbar.svelte";
  import EditorLayout from "./EditorLayout.svelte";
  import GoToSlideDialog from "./GoToSlideDialog.svelte";
  import PresentOverlay from "@/features/presentation/PresentOverlay.svelte";
  import {
    createProjectMutation,
    exportProjectMutation,
    updateProjectThemeMutation,
  } from "$lib/queries";
  import { createAddSlide } from "@/features/slides/add-slide.svelte";
  import { createSlideDuplicator } from "@/features/slides/slide-actions.svelte";
  import { subscribeToAppMenu } from "$lib/lib/app-menu.svelte";
  import { createHighlightNav } from "@/features/highlights/highlight-nav.svelte";
  import { createEditorKeyboard } from "./keyboard.svelte";
  import { createEditorMenuHandlers } from "./menu-handlers";
  import { createEditorState } from "./editor-state.svelte";
  import { createPresentFullscreen } from "@/features/presentation/fullscreen.svelte";

  let { projectId }: { projectId?: string } = $props();

  // `projectId` is a fixed prop (the route wrapper keys this component on
  // it), so project-scoped factories capture the right id for life.
  // untrack() marks that one-time capture as deliberate.
  const pid = untrack(() => projectId ?? "");

  // Route state (query + title/selection lifecycle effects).
  const st = createEditorState({ pid, projectId: () => projectId });
  const projQuery = st.query;
  const project = $derived(st.project);
  const slides = $derived(st.slides);

  const exportMutation = exportProjectMutation();
  const duplicateSlide = createSlideDuplicator(pid);
  const updateTheme = updateProjectThemeMutation(pid);
  const createProject = createProjectMutation();
  const { addSlide } = createAddSlide(pid, () => project);

  // -- Current slide + highlight navigation --
  const cs = createCurrentSlide(() => project);
  const activeSlide = $derived(cs.activeSlide);
  const currentIndex = $derived(cs.activeIndex);

  const nav = createHighlightNav({
    slides: () => slides,
    currentIndex: () => currentIndex,
    currentSlideId: () => ui.currentSlideId,
    setCurrentSlideId,
  });
  const activeHighlightIndex = $derived(nav.highlightIndex);

  const { enterPresent, exitPresent } = createPresentFullscreen();

  // -- Keyboard (number keys 1-9 jump to highlight) --
  createEditorKeyboard(() => ({
    goNext: nav.goNext,
    goPrev: nav.goPrev,
    goToHighlight: nav.goToHighlight,
    exitPresent,
  }));

  // -- Auto-play: advance after each slide duration, respects highlights via goNext --
  $effect(() => {
    if (!ui.isAutoPlaying || !project) return;
    if (slides.length === 0 || currentIndex < 0) return;

    // Read to re-arm the countdown after each highlight step.
    void nav.highlightIndex;

    const ms = Math.max(500, slides[currentIndex]?.duration ?? 3000);
    const timer = window.setTimeout(() => {
      const acted = nav.goNext();
      if (!acted) setIsAutoPlaying(false);
    }, ms);

    return () => window.clearTimeout(timer);
  });

  $effect(() => () => setIsAutoPlaying(false));

  // -- Native app menu --
  const menuHandlers = createEditorMenuHandlers({
    projectId: () => projectId,
    createProject: (name) => createProject.mutateAsync(name),
    exportProject: (id) => exportMutation.mutate(id),
    enterPresent,
    addSlide,
    duplicateSlide,
  });
  subscribeToAppMenu(() => menuHandlers);
</script>

{#if projQuery.isLoading}
  <div class="flex h-full flex-col">
    <TitleBar title="OpenSlides" />
    <AsyncState isLoading isError={false} loadingLabel="Loading project…" />
  </div>
{:else if projQuery.isError || !project}
  <div class="flex h-full flex-col">
    <TitleBar title="OpenSlides" />
    <AsyncState
      isLoading={false}
      isError
      error={(projQuery.error as Error | null) ?? null}
    >
      {#snippet errorAction()}
        <Button onclick={() => void push("/")}>Back to Dashboard</Button>
      {/snippet}
    </AsyncState>
  </div>
{:else}
  <div class="flex h-full flex-col bg-background">
    {#if !ui.isZenMode && !ui.isPresenting}
      <EditorToolbar
        {project}
        {activeSlide}
        activeSlideIndex={Math.max(0, currentIndex)}
        onPresent={() => enterPresent()}
      />
    {/if}

    {#if ui.isPresenting}
      <PresentOverlay
        {project}
        {activeSlide}
        {activeHighlightIndex}
        onHighlightExitComplete={nav.handleExitComplete}
        goNext={nav.goNext}
        goPrev={nav.goPrev}
        goToHighlight={nav.goToHighlight}
        {exitPresent}
      />
    {/if}

    {#if ui.isZenMode && !ui.isPresenting}
      <button
        type="button"
        onclick={() => toggleZenMode()}
        class="absolute right-3 top-3 z-30 rounded-md bg-card/80 px-2 py-1 text-[11px] text-muted-foreground shadow backdrop-blur hover:text-foreground"
      >
        Exit Focus (Esc)
      </button>
    {/if}

    {#if !ui.isPresenting}
      <EditorLayout
        {project}
        {activeSlide}
        {activeHighlightIndex}
        previewHighlightIndex={ui.previewHighlightIndex}
        onHighlightExitComplete={nav.handleExitComplete}
        onSelectHighlight={nav.goToHighlight}
        editorExpanded={st.editorExpanded}
        onToggleEditorExpanded={(v) => (st.editorExpanded = v)}
      />
    {/if}

    <SettingsDrawer
      {project}
      open={ui.isSettingsOpen}
      onClose={() => setIsSettingsOpen(false)}
    />

    <CommandPalette
      projectId={project.id}
      onExport={() => exportMutation.mutate(project.id)}
      onAddSlide={() => void addSlide()}
      onTheme={(theme) => updateTheme.mutate(theme)}
    />
    <GoToSlideDialog {project} />

    <ShortcutsHelp />
  </div>
{/if}
