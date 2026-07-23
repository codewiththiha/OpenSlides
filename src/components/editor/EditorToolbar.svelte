<script lang="ts">
  /**
   * EditorToolbar — top TitleBar bar.
   */
  import { untrack } from "svelte";
  import { push } from "svelte-spa-router";
  import {
    Home,
    MonitorPlay,
    Play,
    Pause,
    Settings2,
    Download,
    Focus,
    Moon,
    Sun,
    Command as CommandIcon,
    Pencil,
  } from "@lucide/svelte";
  import Button from "../ui/Button.svelte";
  import TitleBar from "../TitleBar.svelte";
  import SaveStatusBadge from "./SaveStatusBadge.svelte";
  import InlineEditableText from "../ui/InlineEditableText.svelte";
  import {
    ui,
    toggleAutoPlaying,
    toggleTheme,
    toggleZenMode,
    setIsSettingsOpen,
    setIsCommandOpen,
  } from "@/store/ui-state.svelte";
  import { useExportProject, useUpdateSlideSettings } from "@/queries";
  import { modKeyLabel } from "@/lib/platform";
  import { cn, formatDurationShort } from "@/lib/utils";
  import { slideDisplayName } from "@/types";
  import type { Project, Slide } from "@/types";

  let {
    project,
    activeSlide,
    activeSlideIndex,
    onPresent,
  }: {
    project: Project;
    activeSlide?: Slide;
    activeSlideIndex: number;
    onPresent: () => void;
  } = $props();

  const exportMutation = useExportProject();
  // Stable per mount (rendered only after the project loads, under the
  // project-keyed EditorInner) — untrack() marks the capture as deliberate.
  const updateSlideSettings = useUpdateSlideSettings(untrack(() => project.id));

  let editingSlideName = $state(false);
  let slideNameDraft = $state("");

  const activeSlideName = $derived(
    activeSlide ? slideDisplayName(activeSlide, activeSlideIndex) : "",
  );
  const totalDurationMs = $derived(
    project.slides.reduce((total, slide) => total + slide.duration, 0),
  );

  function commitSlideName() {
    if (!activeSlide) {
      editingSlideName = false;
      return;
    }
    const name = slideNameDraft.trim() || `Slide ${activeSlideIndex + 1}`;
    updateSlideSettings.mutate(
      { slideId: activeSlide.id, payload: { name } },
      { onSettled: () => (editingSlideName = false) },
    );
  }

  const mod = modKeyLabel();
  const isDarkUi = $derived(ui.isDarkUi);
  const isAutoPlaying = $derived(ui.isAutoPlaying);
</script>

<TitleBar class="relative">
  {#snippet leading()}
    <Button
      variant="ghost"
      size="icon"
      class="h-8 w-8"
      onclick={() => void push("/")}
      title="Dashboard"
    >
      <Home class="h-4 w-4" />
    </Button>
    <div class="min-w-0">
      <div class="truncate text-sm font-medium leading-tight">
        {project.name}
      </div>
      <div
        class="truncate text-[10px] text-muted-foreground"
        title="Estimated length: {formatDurationShort(totalDurationMs)}"
      >
        {project.slides.length} slide{project.slides.length !== 1 ? "s" : ""} ·
        ~{formatDurationShort(totalDurationMs)} · {project.theme}
      </div>
    </div>
  {/snippet}

  {#snippet trailing()}
    <div class="pointer-events-none absolute inset-x-0 flex items-center justify-center px-40">
      {#if editingSlideName}
        <InlineEditableText
          value={slideNameDraft}
          onChange={(v) => (slideNameDraft = v)}
          onCommit={commitSlideName}
          onCancel={() => (editingSlideName = false)}
          stopPropagation={false}
          class="pointer-events-auto max-w-[16rem] truncate text-center text-xs font-medium"
        />
      {:else}
        <button
          type="button"
          class="group/name pointer-events-auto inline-flex max-w-[16rem] items-center gap-1.5 truncate rounded-md px-2.5 py-1 text-center text-xs font-medium text-foreground/90 transition-colors hover:bg-muted/70"
          title="Rename current slide"
          onclick={() => {
            slideNameDraft = activeSlideName;
            editingSlideName = true;
          }}
        >
          <span class="truncate">{activeSlideName}</span>
          <Pencil class="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/name:opacity-100" />
        </button>
      {/if}
    </div>

    <SaveStatusBadge status={ui.saveStatus} />

    <Button
      variant="ghost"
      size="icon"
      class={cn("h-8 w-8", isAutoPlaying && "bg-primary/15 text-primary")}
      title={isAutoPlaying
        ? "Pause autoplay"
        : "Play (auto-advance by slide duration)"}
      onclick={toggleAutoPlaying}
    >
      {#if isAutoPlaying}
        <Pause class="h-4 w-4" />
      {:else}
        <Play class="h-4 w-4" />
      {/if}
    </Button>

    <Button
      variant="ghost"
      size="icon"
      class="h-8 w-8"
      title="Command palette ({mod}K)"
      onclick={() => setIsCommandOpen(true)}
    >
      <CommandIcon class="h-3.5 w-3.5" />
    </Button>

    <Button
      variant="ghost"
      size="icon"
      class="h-8 w-8"
      title="Toggle light/dark mode"
      onclick={toggleTheme}
    >
      {#if isDarkUi}
        <Sun class="h-4 w-4" />
      {:else}
        <Moon class="h-4 w-4" />
      {/if}
    </Button>

    <Button
      variant="ghost"
      size="icon"
      class="h-8 w-8"
      title="Focus mode ({mod}B)"
      onclick={toggleZenMode}
    >
      <Focus class="h-4 w-4" />
    </Button>

    <Button
      variant="ghost"
      size="icon"
      class="h-8 w-8"
      title="Export"
      onclick={() => exportMutation.mutate(project.id)}
    >
      <Download class="h-4 w-4" />
    </Button>

    <Button
      variant="ghost"
      size="icon"
      class="h-8 w-8"
      title="Settings"
      onclick={() => setIsSettingsOpen(true)}
    >
      <Settings2 class="h-4 w-4" />
    </Button>

    <Button size="sm" class="ml-1 gap-1.5" onclick={onPresent}>
      <MonitorPlay class="h-3.5 w-3.5" />
      Present
    </Button>
  {/snippet}
</TitleBar>
