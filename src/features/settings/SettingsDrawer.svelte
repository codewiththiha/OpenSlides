<script lang="ts">
  /**
   * Right-side settings drawer for global project options.
   * Desktop-style rail + grouped settings cards.
   */
  import { untrack } from "svelte";
  import { fade } from "svelte/transition";
  import { LayoutGrid, Palette, RotateCcw, Sparkles, X } from "@lucide/svelte";
  import Button from "$lib/ui/Button.svelte";
  import { type Project, type ThemeName } from "$lib/types";
  import {
    updateProjectSettingsMutation,
    updateProjectThemeMutation,
  } from "$lib/queries";
  import {
    setEditorShowLineNumbers,
    setPreviewProjectSetting,
    setShowSlideHoverPreview,
    clearPreviewProjectSetting,
  } from "$lib/stores/ui-state.svelte";
  import { previewProjectSettings } from "@/features/settings/preview-settings";
  import { cn } from "$lib/lib/utils";
  import { Z_INDEX } from "$lib/ui/Overlay.svelte";
  import { escapeKey } from "$lib/actions/escape-key";
  import SettingsSection from "$lib/ui/SettingsSection.svelte";
  import GlobalAnimationSection from "@/features/settings/GlobalAnimationSection.svelte";
  import DrawerThemeSection from "./drawer/DrawerThemeSection.svelte";
  import DrawerCodeLayoutSection from "./drawer/DrawerCodeLayoutSection.svelte";
  import DrawerCodeBackgroundSection from "./drawer/DrawerCodeBackgroundSection.svelte";
  import DrawerLineNumbersSection from "./drawer/DrawerLineNumbersSection.svelte";
  import DimColorPicker from "./DimColorPicker.svelte";
  import type { SettingsPatch } from "$lib/lib/tauri-api";
  import type {
    GlobalAnimationKey,
    PreviewProjectSettings,
  } from "$lib/stores/types";

  let {
    project,
    open,
    onClose,
  }: {
    project: Project;
    open: boolean;
    onClose: () => void;
  } = $props();

  type DrawerTab = "theme" | "layout" | "motion";

  const TAB_ITEMS: { id: DrawerTab; label: string; description: string }[] = [
    {
      id: "theme",
      label: "Theme",
      description: "Themes and code backdrop",
    },
    {
      id: "layout",
      label: "Layout",
      description: "Code placement and visibility",
    },
    {
      id: "motion",
      label: "Motion",
      description: "Deck-wide animation overrides",
    },
  ];

  const DEFAULT_THEME: ThemeName = "dark-plus";
  const DEFAULT_SETTINGS_PATCH = {
    showLineNumbers: true,
    useBlackCodeBackground: false,
    showHighlightStepIndicator: true,
    fontSize: 16,
    lineHeight: 1.5,
    editorFontSize: 14,
    useGlobalTransition: false,
    globalTransitionDuration: 750,
    useGlobalStagger: false,
    globalStagger: 5,
    useGlobalHighlight: false,
    globalDimAmount: 75,
    globalSizeUpAmount: 100,
    highlightDimColor: "black",
    codeAlign: "left",
  } satisfies SettingsPatch;

  // The drawer is mounted under the project-keyed EditorInner, so project.id
  // is stable for this mount — untrack() marks the one-time capture.
  const projectId = untrack(() => project.id);
  const updateSettings = updateProjectSettingsMutation(projectId);
  const updateTheme = updateProjectThemeMutation(projectId);

  let activeTab = $state<DrawerTab>("theme");
  let railEl: HTMLElement | undefined = $state();
  let resetConfirmOpen = $state(false);

  const previewProject = $derived(previewProjectSettings());
  const reduceMotion = $derived(
    typeof window !== "undefined" &&
      "matchMedia" in window &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  $effect(() => {
    if (!open) {
      clearPreviewProjectSetting("theme");
      resetConfirmOpen = false;
    }
  });

  const s = $derived(project.settings);

  // effective values (preview wins)
  const effGlobalTransition = $derived(
    previewProject.globalTransitionDuration ?? s.globalTransitionDuration,
  );
  const effGlobalStagger = $derived(
    previewProject.globalStagger ?? s.globalStagger,
  );
  const effGlobalDimAmount = $derived(
    previewProject.globalDimAmount ?? s.globalDimAmount ?? 75,
  );
  const effGlobalSizeUpAmount = $derived(
    previewProject.globalSizeUpAmount ?? s.globalSizeUpAmount ?? 100,
  );
  const effHighlightDimColor = $derived(
    (previewProject.highlightDimColor ?? s.highlightDimColor ?? "black") as
      "black" | "theme",
  );
  const effTheme = $derived(previewProject.theme ?? project.theme);
  const activeTabIndex = $derived(
    Math.max(
      0,
      TAB_ITEMS.findIndex((tab) => tab.id === activeTab),
    ),
  );
  const activeTabTitle = $derived(
    TAB_ITEMS.find((tab) => tab.id === activeTab)?.label ?? "Settings",
  );
  const globalMotionActive = $derived(
    s.useGlobalTransition || s.useGlobalStagger || s.useGlobalHighlight,
  );

  // Sample code for theme preview (first 6 lines of current slide)
  const sampleCode = $derived(
    (
      project.slides.find(
        (slide) => slide.id === project.settings.currentSlideId,
      )?.code ??
      project.slides[0]?.code ??
      ""
    )
      .split("\n")
      .slice(0, 6)
      .join("\n"),
  );

  function patch(partial: SettingsPatch) {
    updateSettings.mutate(partial);
  }

  function previewGlobalSetting(
    key: GlobalAnimationKey,
    value: number | string,
  ) {
    const typedKey = key as keyof PreviewProjectSettings;
    setPreviewProjectSetting(
      typedKey,
      value as PreviewProjectSettings[typeof typedKey],
    );
  }

  function focusRailTab(index: number) {
    const nextIndex = Math.min(Math.max(index, 0), TAB_ITEMS.length - 1);
    const tab = TAB_ITEMS[nextIndex];
    if (!tab) return;
    activeTab = tab.id;
    requestAnimationFrame(() => {
      railEl
        ?.querySelector<HTMLButtonElement>(`[data-tab-index="${nextIndex}"]`)
        ?.focus();
    });
  }

  function handleRailKeydown(event: KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      focusRailTab(activeTabIndex + 1);
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      focusRailTab(activeTabIndex - 1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusRailTab(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      focusRailTab(TAB_ITEMS.length - 1);
    }
  }

  function handlePreviewTheme(theme: ThemeName) {
    setPreviewProjectSetting("theme", theme);
  }

  function clearThemePreview() {
    clearPreviewProjectSetting("theme");
  }

  function resetThemeSection() {
    clearThemePreview();
    updateTheme.mutate(DEFAULT_THEME);
  }

  function resetLayoutSection() {
    patch({ codeAlign: "left" });
  }

  function resetBackgroundSection() {
    clearPreviewProjectSetting("useBlackCodeBackground");
    patch({ useBlackCodeBackground: false });
  }

  function resetDimColorSection() {
    clearPreviewProjectSetting("highlightDimColor");
    patch({ highlightDimColor: "black" });
  }

  function resetLineNumbersSection() {
    patch({
      showLineNumbers: true,
      showHighlightStepIndicator: true,
      fontSize: 16,
      lineHeight: 1.5,
      editorFontSize: 14,
    });
    setEditorShowLineNumbers(true);
    setShowSlideHoverPreview(true);
  }

  function resetMotionSection() {
    patch({
      useGlobalTransition: false,
      globalTransitionDuration: 750,
      useGlobalStagger: false,
      globalStagger: 5,
      useGlobalHighlight: false,
      globalDimAmount: 75,
      globalSizeUpAmount: 100,
    });
  }

  function resetAllSettings() {
    clearThemePreview();
    clearPreviewProjectSetting("useBlackCodeBackground");
    clearPreviewProjectSetting("highlightDimColor");
    clearPreviewProjectSetting("fontSize");
    clearPreviewProjectSetting("lineHeight");
    clearPreviewProjectSetting("editorFontSize");
    clearPreviewProjectSetting("globalTransitionDuration");
    clearPreviewProjectSetting("globalStagger");
    clearPreviewProjectSetting("globalDimAmount");
    clearPreviewProjectSetting("globalSizeUpAmount");
    updateTheme.mutate(DEFAULT_THEME);
    patch(DEFAULT_SETTINGS_PATCH);
    setEditorShowLineNumbers(true);
    setShowSlideHoverPreview(true);
    resetConfirmOpen = false;
  }

  function handleEscape() {
    if (!open) return;
    if (resetConfirmOpen) {
      resetConfirmOpen = false;
      return;
    }
    onClose();
  }
</script>

<button
  type="button"
  aria-label="Close settings drawer"
  class={cn(
    "fixed inset-0 bg-black/25 backdrop-blur-[2px] motion-safe:transition-opacity motion-safe:duration-200 motion-reduce:transition-none",
    open ? "opacity-100" : "pointer-events-none opacity-0",
  )}
  style="z-index: {Z_INDEX.drawerBackdrop};"
  onclick={onClose}
></button>

<div
  class={cn(
    "fixed top-0 right-0 flex h-full w-[420px] flex-col overflow-hidden border-l-2 border-l-primary/20 bg-card shadow-2xl will-change-transform motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.2,0.9,0.25,1)] motion-reduce:transition-none",
    open ? "translate-x-0" : "translate-x-full",
  )}
  style="z-index: {Z_INDEX.drawer};"
  role="dialog"
  aria-modal={open}
  aria-label="Presentation settings"
  use:escapeKey={{ onEscape: handleEscape, delayMs: 50 }}
>
  <div class="flex h-14 shrink-0 items-center justify-between border-b px-4">
    <div class="min-w-0">
      <div class="flex items-center gap-2">
        <h2 class="truncate text-sm font-semibold">Presentation Settings</h2>
        <span
          class="rounded border border-border/60 bg-muted/35 px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground"
        >
          Esc
        </span>
      </div>
      <p class="mt-0.5 truncate text-[11px] text-muted-foreground">
        {activeTabTitle} · {TAB_ITEMS[activeTabIndex]?.description}
      </p>
    </div>

    <div class="flex shrink-0 items-center gap-1.5">
      <div class="relative">
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          onclick={() => {
            resetConfirmOpen = !resetConfirmOpen;
          }}
          aria-label="Reset all settings"
          aria-expanded={resetConfirmOpen}
        >
          <RotateCcw class="h-4 w-4" />
        </Button>

        {#if resetConfirmOpen}
          <div
            class="absolute top-10 right-0 z-20 w-60 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-2xl"
            transition:fade={{ duration: reduceMotion ? 0 : 100 }}
          >
            <div class="text-sm font-medium">Reset all settings?</div>
            <p class="mt-1 text-[11px] leading-snug text-muted-foreground">
              This restores the drawer settings to defaults, including the
              theme, layout, typography, and motion controls.
            </p>
            <div class="mt-3 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                class="h-7 px-2 text-[11px]"
                onclick={() => {
                  resetConfirmOpen = false;
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                class="h-7 px-2 text-[11px]"
                onclick={resetAllSettings}
              >
                Reset
              </Button>
            </div>
          </div>
        {/if}
      </div>

      <Button
        variant="ghost"
        size="icon"
        class="h-8 w-8 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        onclick={onClose}
        aria-label="Close settings"
      >
        <X class="h-4 w-4" />
      </Button>
    </div>
  </div>

  <div class="flex min-h-0 flex-1">
    <div
      bind:this={railEl}
      role="tablist"
      aria-orientation="vertical"
      class="flex w-12 shrink-0 flex-col items-center gap-2 border-r bg-muted/10 px-2 py-4"
      aria-label="Settings sections"
    >
      {#each TAB_ITEMS as tab, index (tab.id)}
        {@const active = activeTab === tab.id}
        <button
          type="button"
          class={cn(
            "group relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none",
            active &&
              "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
          )}
          role="tab"
          aria-label={tab.label}
          aria-selected={active}
          aria-controls={`settings-panel-${tab.id}`}
          id={`settings-tab-${tab.id}`}
          title={tab.label}
          data-tab-index={index}
          onkeydown={handleRailKeydown}
          onclick={() => {
            activeTab = tab.id;
          }}
        >
          {#if tab.id === "theme"}
            <Palette class="h-4 w-4" />
          {:else if tab.id === "layout"}
            <LayoutGrid class="h-4 w-4" />
          {:else}
            <Sparkles class="h-4 w-4" />
          {/if}
          <span
            class="pointer-events-none absolute top-1/2 left-full z-30 ml-2 -translate-y-1/2 rounded-md border border-border bg-popover px-2 py-1 text-[11px] whitespace-nowrap text-popover-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            {tab.label}
          </span>
        </button>
      {/each}
    </div>

    <div
      id={`settings-panel-${activeTab}`}
      role="tabpanel"
      aria-labelledby={`settings-tab-${activeTab}`}
      class="min-w-0 flex-1 overflow-y-auto p-4"
      aria-label={activeTabTitle}
    >
      {#key activeTab}
        <div
          class="space-y-6"
          transition:fade={{ duration: reduceMotion ? 0 : 120 }}
        >
          {#if activeTab === "theme"}
            <DrawerThemeSection
              currentTheme={project.theme}
              {sampleCode}
              onPreviewTheme={handlePreviewTheme}
              onClearPreviewTheme={clearThemePreview}
              onCommitTheme={(theme: ThemeName) => updateTheme.mutate(theme)}
              onReset={resetThemeSection}
            />

            <DrawerCodeBackgroundSection
              checked={s.useBlackCodeBackground}
              theme={effTheme}
              onChange={(v) => patch({ useBlackCodeBackground: v })}
              onReset={resetBackgroundSection}
            />

            <SettingsSection
              title="Highlight dim color"
              description="Choose the color used behind non-focused code during highlights."
              onReset={resetDimColorSection}
            >
              <DimColorPicker
                value={effHighlightDimColor}
                theme={effTheme}
                onPreview={(v) =>
                  setPreviewProjectSetting("highlightDimColor", v)}
                onPreviewEnd={() =>
                  clearPreviewProjectSetting("highlightDimColor")}
                onCommit={(v) => patch({ highlightDimColor: v })}
              />
            </SettingsSection>
          {:else if activeTab === "layout"}
            <DrawerCodeLayoutSection
              value={s.codeAlign ?? "left"}
              onChange={(align) => patch({ codeAlign: align })}
              onReset={resetLayoutSection}
            />

            <DrawerLineNumbersSection
              settings={s}
              onPatch={patch}
              onReset={resetLineNumbersSection}
            />
          {:else}
            <SettingsSection
              title="Global Animations"
              description="When on, every slide uses these animation values and the per-slide sliders are locked."
              badge={globalMotionActive ? "GLOBAL" : undefined}
              onReset={resetMotionSection}
            >
              <p class="text-[11px] text-muted-foreground">
                Stagger is the delay between each animated character.
              </p>
              <GlobalAnimationSection
                settings={s}
                effTransition={effGlobalTransition}
                effStagger={effGlobalStagger}
                {effGlobalDimAmount}
                {effGlobalSizeUpAmount}
                onPreview={previewGlobalSetting}
                onCommit={patch}
              />
            </SettingsSection>
          {/if}
        </div>
      {/key}
    </div>
  </div>
</div>
