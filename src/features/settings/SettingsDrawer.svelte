<script lang="ts">
  /**
   * Right-side settings drawer for global project options.
   * Tabbed layout for better UX: Appearance | Layout | Motion
   */
  import { untrack } from "svelte";
  import { X, Palette, LayoutGrid, Sparkles, RotateCcw } from "@lucide/svelte";
  import Button from "$lib/ui/Button.svelte";
  import { type Project, type ThemeName } from "$lib/types";
  import {
    updateProjectSettingsMutation,
    updateProjectThemeMutation,
  } from "$lib/queries";
  import {
    setPreviewProjectSetting,
    clearPreviewProjectSetting,
  } from "$lib/stores/ui-state.svelte";
  import { previewProjectSettings } from "@/features/settings/preview-settings";
  import { cn } from "$lib/lib/utils";
  import { Z_INDEX } from "$lib/ui/Overlay.svelte";
  import type { PreviewProjectSettings } from "$lib/stores/types";

  import GlobalAnimationSection from "@/features/settings/GlobalAnimationSection.svelte";
  import DrawerThemeSection from "./drawer/DrawerThemeSection.svelte";
  import DrawerCodeLayoutSection from "./drawer/DrawerCodeLayoutSection.svelte";
  import DrawerCodeBackgroundSection from "./drawer/DrawerCodeBackgroundSection.svelte";
  import DrawerLineNumbersSection from "./drawer/DrawerLineNumbersSection.svelte";
  import DimColorPicker from "./DimColorPicker.svelte";
  import SettingsSection from "$lib/ui/SettingsSection.svelte";

  let {
    project,
    open,
    onClose,
  }: {
    project: Project;
    open: boolean;
    onClose: () => void;
  } = $props();

  const projectId = untrack(() => project.id);
  const updateSettings = updateProjectSettingsMutation(projectId);
  const updateTheme = updateProjectThemeMutation(projectId);

  const previewProject = $derived(previewProjectSettings());

  $effect(() => {
    if (!open) clearPreviewProjectSetting("theme");
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

  let activeTab = $state<"appearance" | "layout" | "motion">("appearance");

  const TABS = [
    { id: "appearance" as const, label: "Appearance", icon: Palette },
    { id: "layout" as const, label: "Layout", icon: LayoutGrid },
    { id: "motion" as const, label: "Motion", icon: Sparkles },
  ];

  function patch(partial: Parameters<typeof updateSettings.mutate>[0]) {
    updateSettings.mutate(partial);
  }

  function resetToDefaults() {
    patch({
      fontSize: 16,
      lineHeight: 1.55,
      editorFontSize: 14,
      showLineNumbers: true,
      showHighlightStepIndicator: true,
      useBlackCodeBackground: false,
      codeAlign: "left",
      useGlobalTransition: false,
      globalTransitionDuration: 300,
      useGlobalStagger: false,
      globalStagger: 0,
      useGlobalHighlight: false,
      globalDimAmount: 75,
      globalSizeUpAmount: 100,
      highlightDimColor: "black",
    });
  }
</script>

<!-- Non-blocking backdrop - user can still see the preview while adjusting -->
<div
  class={cn(
    "fixed inset-0 bg-black/10 transition-opacity",
    open ? "opacity-100" : "pointer-events-none opacity-0",
  )}
  style="z-index: {Z_INDEX.drawerBackdrop};"
  onclick={onClose}
></div>

<aside
  class={cn(
    "fixed top-0 right-0 flex h-full w-[380px] flex-col border-l bg-card shadow-[-8px_0_24px_rgba(0,0,0,0.12)] transition-transform duration-200",
    open ? "translate-x-0" : "translate-x-full",
  )}
  style="z-index: {Z_INDEX.drawer};"
  aria-label="Presentation settings"
>
  <!-- Header -->
  <div class="flex h-12 items-center justify-between border-b px-4">
    <h2 class="text-sm font-semibold">Presentation Settings</h2>
    <Button variant="ghost" size="icon" class="h-8 w-8" onclick={onClose}>
      <X class="h-4 w-4" />
    </Button>
  </div>

  <!-- Tab bar -->
  <div
    class="flex border-b px-1"
    role="tablist"
    aria-label="Settings categories"
  >
    {#each TABS as tab (tab.id)}
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === tab.id}
        onclick={() => (activeTab = tab.id)}
        class={cn(
          "flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors",
          activeTab === tab.id
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground",
        )}
      >
        <tab.icon class="h-3.5 w-3.5" />
        {tab.label}
      </button>
    {/each}
  </div>

  <!-- Tab content -->
  <div class="flex-1 space-y-6 overflow-y-auto p-4">
    {#if activeTab === "appearance"}
      <DrawerThemeSection
        currentTheme={project.theme}
        onCommitTheme={(theme: ThemeName) => updateTheme.mutate(theme)}
        {sampleCode}
      />

      <DrawerCodeBackgroundSection
        checked={s.useBlackCodeBackground}
        onChange={(v) => patch({ useBlackCodeBackground: v })}
      />

      <DimColorPicker
        value={effHighlightDimColor}
        theme={project.theme}
        onCommit={(v) => patch({ highlightDimColor: v })}
      />
    {:else if activeTab === "layout"}
      <DrawerCodeLayoutSection
        value={s.codeAlign ?? "left"}
        onChange={(align) => patch({ codeAlign: align })}
      />

      <DrawerLineNumbersSection settings={s} onPatch={patch} />
    {:else}
      <!-- Motion tab -->
      <SettingsSection
        title="Global Animations"
        description="When on, every slide uses these values. Per-slide controls are disabled."
        borderTop
      >
        <GlobalAnimationSection
          settings={s}
          effTransition={effGlobalTransition}
          effStagger={effGlobalStagger}
          {effGlobalDimAmount}
          {effGlobalSizeUpAmount}
          onPreview={(key, value) => {
            const typedKey = key as keyof PreviewProjectSettings;
            setPreviewProjectSetting(
              typedKey,
              value as PreviewProjectSettings[typeof typedKey],
            );
          }}
          onCommit={patch}
        />
      </SettingsSection>
    {/if}
  </div>

  <!-- Footer: Reset -->
  <div class="border-t px-4 py-3">
    <Button
      variant="ghost"
      size="sm"
      class="w-full text-muted-foreground hover:text-foreground"
      onclick={resetToDefaults}
    >
      <RotateCcw class="mr-1.5 h-3.5 w-3.5" />
      Reset to defaults
    </Button>
  </div>
</aside>
