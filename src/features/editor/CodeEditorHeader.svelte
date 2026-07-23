<script lang="ts">
  import {
    Maximize2,
    Minimize2,
    PanelRightClose,
    Highlighter as HighlighterIcon,
    Search,
  } from "@lucide/svelte";
  import Button from "$lib/ui/Button.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";
  import EditorSlideNav from "./EditorSlideNav.svelte";
  import { cn } from "$lib/lib/utils";
  import { SUPPORTED_LANGUAGES } from "$lib/types";
  import type { Project } from "$lib/types";

  let {
    project,
    currentIndex,
    language,
    highlightMode,
    highlightCount,
    expanded,
    onNavigate,
    onLanguageChange,
    onToggleHighlightMode,
    onToggleExpand,
    onCollapse,
    onToggleFind,
  }: {
    project: Project;
    currentIndex: number;
    language: string;
    highlightMode: boolean;
    highlightCount: number;
    expanded: boolean | undefined;
    onNavigate: (dir: -1 | 1) => void;
    onLanguageChange: (value: string) => void;
    onToggleHighlightMode: () => void;
    onToggleExpand: (() => void) | undefined;
    onCollapse: (() => void) | undefined;
    onToggleFind: () => void;
  } = $props();
</script>

<div
  class="flex h-10 shrink-0 items-center justify-between gap-2 border-b px-2"
>
  <EditorSlideNav
    index={currentIndex}
    total={project.slides.length}
    {onNavigate}
  />

  <div class="flex min-w-0 items-center gap-1">
    <SelectField
      selectSize="sm"
      options={SUPPORTED_LANGUAGES}
      value={language}
      onchange={(e) => onLanguageChange(e.currentTarget.value)}
      title="Code language"
    />

    <Button
      variant="ghost"
      size="icon"
      class={cn(
        "relative h-7 w-7 shrink-0",
        highlightMode && "bg-primary/15 text-primary",
      )}
      onclick={onToggleHighlightMode}
      title={highlightMode
        ? "Highlight mode is on — select code and right-click to add a highlight"
        : "Toggle highlight mode"}
    >
      <HighlighterIcon class="h-3.5 w-3.5" />
      {#if highlightCount > 0}
        <span
          class="absolute -top-0.5 -right-0.5 flex h-3 min-w-3 items-center justify-center rounded-full bg-primary px-0.5 text-[8px] leading-none font-semibold text-primary-foreground"
        >
          {highlightCount}
        </span>
      {/if}
    </Button>

    {#if onToggleExpand}
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7 shrink-0"
        onclick={onToggleExpand}
        title={expanded ? "Exit expanded view" : "Expand editor"}
      >
        {#if expanded}
          <Minimize2 class="h-3.5 w-3.5" />
        {:else}
          <Maximize2 class="h-3.5 w-3.5" />
        {/if}
      </Button>
    {/if}
    {#if onCollapse && !expanded}
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7 shrink-0"
        onclick={onCollapse}
        title="Collapse code panel"
      >
        <PanelRightClose class="h-3.5 w-3.5" />
      </Button>
    {/if}
    <Button
      variant="ghost"
      size="icon"
      class="h-7 w-7 shrink-0"
      onclick={onToggleFind}
      title="Find/Replace (Cmd+F)"
    >
      <Search class="h-3.5 w-3.5" />
    </Button>
  </div>
</div>
