<script lang="ts">
  /**
   * EditorInner — orchestrator, no longer a God component.
   *
   * Svelte 5 port of the React Editor body. Delegates to:
   *  - EditorToolbar (TitleBar + save badge + slide name + actions)
   *  - EditorLayout (resizable preview/code/slides)
   *  - PresentOverlay (fullscreen stage)
   *  - createEditorKeyboard (reads getState()-style via the ui $state inside)
   *  - createPresentFullscreen (enter/exit/fullscreenchange)
   *  - ui-state runes replacing the old Zustand slices
   *
   * `projectId` is a fixed prop (the route wrapper keys this component on
   * it), so project-scoped mutation hooks capture the right id for life.
   *
   * Divergence note: React's `resetEditorUi` cleanup ran only when leaving
   * the editor route; here the keyed remount also resets it on project
   * switch. Harmless — the initial-slide effect immediately re-selects
   * `settings.currentSlideId ?? slides[0]`, matching the React end state.
   */
  import { untrack } from "svelte";
  import { push } from "svelte-spa-router";
  import {
    ui,
    setCurrentSlideId,
    setIsSettingsOpen,
    setIsCommandOpen,
    setIsShortcutsOpen,
    setIsAutoPlaying,
    toggleZenMode,
    toggleTheme,
    clearAllPreviewSettings,
    resetEditorUi,
  } from "$lib/stores/ui-state.svelte";
  import { createCurrentSlide } from "@/features/slides/current-slide.svelte";
  import Button from "$lib/ui/Button.svelte";
  import TitleBar from "$lib/components/TitleBar.svelte";
  import SettingsDrawer from "@/features/settings/SettingsDrawer.svelte";
  import AsyncState from "$lib/components/AsyncState.svelte";
  import CommandPalette from "$lib/components/CommandPalette.svelte";
  import ShortcutsHelp from "$lib/components/ShortcutsHelp.svelte";
  import GoToSlideDialog from "@/features/editor/GoToSlideDialog.svelte";
  import EditorToolbar from "./EditorToolbar.svelte";
  import EditorLayout from "./EditorLayout.svelte";
  import PresentOverlay from "@/features/presentation/PresentOverlay.svelte";
  import {
    projectQuery,
    createProjectMutation,
    exportProjectMutation,
    updateProjectThemeMutation,
  } from "$lib/queries";
  import { createAddSlide } from "@/features/slides/add-slide.svelte";
  import { createSlideDuplicator } from "@/features/slides/slide-actions.svelte";
  import { api } from "$lib/lib/tauri-api";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { subscribeToAppMenu } from "$lib/lib/app-menu.svelte";
  import { createHighlightNav } from "@/features/highlights/highlight-nav.svelte";
  import { createEditorKeyboard } from "@/features/editor/keyboard.svelte";
  import { createPresentFullscreen } from "@/features/presentation/fullscreen.svelte";
  import { dismissAllUndoToasts } from "$lib/lib/settings-undo";

  let { projectId }: { projectId?: string } = $props();

  // `projectId` is a fixed prop (the route wrapper keys this component on
  // it), so project-scoped mutation hooks capture the right id for life.
  // untrack() marks that one-time capture as deliberate.
  const pid = untrack(() => projectId ?? "");

  // Project data (TanStack) — owns slides / theme / settings
  const projQuery = projectQuery(pid);
  const project = $derived(projQuery.data);

  const exportMutation = exportProjectMutation();
  const duplicateSlide = createSlideDuplicator(pid);
  const updateTheme = updateProjectThemeMutation(pid);
  const createProject = createProjectMutation();
  const { addSlide } = createAddSlide(pid, () => project);

  let editorExpanded = $state(false);

  // -- Side effects: title, initial slide, debounced currentSlide persistence --
  const title = $derived(project ? `OpenSlides — ${project.name}` : "OpenSlides");
  // Native + document window title follows the open project's name.
  $effect(() => {
    document.title = title;
    getCurrentWindow().setTitle(title).catch(() => undefined);
  });

  $effect(() => {
    const p = project;
    if (!p) return;
    const cid = ui.currentSlideId;
    if (!cid || !p.slides.some((s) => s.id === cid)) {
      const id = p.settings.currentSlideId ?? p.slides[0]?.id ?? null;
      setCurrentSlideId(id);
    }
  });

  $effect(() => {
    const pid = projectId;
    const cid = ui.currentSlideId;
    if (!pid || !cid) return;
    const t = window.setTimeout(() => {
      api.setCurrentSlide(pid, cid).catch(() => undefined);
    }, 300);
    return () => window.clearTimeout(t);
  });

  $effect(() => {
    // Clear transient preview overrides and stale setting undos on project switch.
    void projectId;
    clearAllPreviewSettings();
    dismissAllUndoToasts();
  });

  $effect(() => () => resetEditorUi());

  // -- Highlight navigation --
  const slides = $derived(project?.slides ?? []);

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

  // -- Fullscreen present --
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

    // Read to re-arm the countdown after each highlight step (React dep parity).
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
  // React kept refs + a memoized map to stabilize listeners; the Svelte
  // subscribeToAppMenu subscribes once and handlers read fresh state from `ui`
  // directly, so no refs are needed.
  const menuHandlers = {
    "menu://new-project": () => {
      void createProject.mutateAsync("Untitled Presentation").then((p) => {
        void push(`/editor/${p.id}`);
      });
    },
    "menu://open-dashboard": () => void push("/"),
    "menu://export": () => {
      if (projectId) exportMutation.mutate(projectId);
    },
    "menu://present": () => enterPresent(),
    "menu://zen": () => toggleZenMode(),
    "menu://settings": () => setIsSettingsOpen(true),
    "menu://command-palette": () => setIsCommandOpen(true),
    "menu://add-slide": () => {
      if (projectId) void addSlide();
    },
    "menu://duplicate-slide": () => {
      if (projectId && ui.currentSlideId) duplicateSlide(ui.currentSlideId);
    },
    "menu://toggle-theme": () => toggleTheme(),
    "menu://shortcuts-app": () => setIsShortcutsOpen(true),
    "menu://shortcuts-help": () => setIsShortcutsOpen(true),
    "menu://undo": () => {
      window.dispatchEvent(new Event("openslides:undo"));
    },
    "menu://redo": () => {
      window.dispatchEvent(new Event("openslides:redo"));
    },
  };
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
        {editorExpanded}
        onToggleEditorExpanded={(v) => (editorExpanded = v)}
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
