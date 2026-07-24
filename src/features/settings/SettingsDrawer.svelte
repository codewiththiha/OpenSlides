<script lang="ts">
  /** Right-side settings panel for project-level presentation options. */
  import { untrack } from "svelte";
  import { X } from "@lucide/svelte";
  import Button from "$lib/ui/Button.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import { type Project, type ThemeName } from "$lib/types";
  import {
    updateProjectSettingsMutation,
    updateProjectThemeMutation,
  } from "$lib/queries";
  import {
    clearPreviewProjectSetting,
    setEditorShowLineNumbers,
    setPreviewProjectSetting,
    setShowSlideHoverPreview,
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
  import DrawerPreviewSection from "./drawer/DrawerPreviewSection.svelte";
  import DrawerEditorSection from "./drawer/DrawerEditorSection.svelte";
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

  const TABS: { id: DrawerTab; label: string }[] = [
    { id: "theme", label: "Theme" },
    { id: "layout", label: "Layout" },
    { id: "motion", label: "Motion" },
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

  const projectId = untrack(() => project.id);
  const updateSettings = updateProjectSettingsMutation(projectId);
  const updateTheme = updateProjectThemeMutation(projectId);

  let activeTab = $state<DrawerTab>("theme");
  let resetConfirmOpen = $state(false);
  let drawerEl: HTMLElement | null = $state(null);

  const previewProject = $derived(previewProjectSettings());

  $effect(() => {
    if (!open) {
      clearTransientPreviews();
      resetConfirmOpen = false;
    }
  });

  $effect(() => {
    if (!open) return;

    function handleDocumentPointerDown(event: PointerEvent) {
      if (resetConfirmOpen) return;
      const target = event.target;
      if (target instanceof Node && drawerEl?.contains(target)) return;
      onClose();
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown, true);
    return () => {
      document.removeEventListener(
        "pointerdown",
        handleDocumentPointerDown,
        true,
      );
    };
  });

  const s = $derived(project.settings);
  const activeTabIndex = $derived(
    Math.max(
      0,
      TABS.findIndex((tab) => tab.id === activeTab),
    ),
  );

  const effTheme = $derived(previewProject.theme ?? project.theme);
  const effFontSize = $derived(previewProject.fontSize ?? s.fontSize);
  const effLineHeight = $derived(previewProject.lineHeight ?? s.lineHeight);
  const effEditorFontSize = $derived(
    previewProject.editorFontSize ?? s.editorFontSize,
  );
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
  const globalMotionActive = $derived(
    s.useGlobalTransition || s.useGlobalStagger || s.useGlobalHighlight,
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

  function clearTransientPreviews() {
    clearPreviewProjectSetting("theme");
    clearPreviewProjectSetting("useBlackCodeBackground");
    clearPreviewProjectSetting("highlightDimColor");
    clearPreviewProjectSetting("fontSize");
    clearPreviewProjectSetting("lineHeight");
    clearPreviewProjectSetting("editorFontSize");
    clearPreviewProjectSetting("globalTransitionDuration");
    clearPreviewProjectSetting("globalStagger");
    clearPreviewProjectSetting("globalDimAmount");
    clearPreviewProjectSetting("globalSizeUpAmount");
  }

  function handlePreviewTheme(theme: ThemeName) {
    setPreviewProjectSetting("theme", theme);
  }

  function clearThemePreview() {
    clearPreviewProjectSetting("theme");
  }

  function resetAllSettings() {
    clearTransientPreviews();
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

<div
  class="pointer-events-none fixed inset-0"
  style="z-index: {Z_INDEX.drawer};"
  aria-hidden={!open}
>
  <div
    bind:this={drawerEl}
    class={cn(
      "pointer-events-auto absolute top-0 right-0 flex h-full w-[420px] flex-col overflow-hidden rounded-l-2xl border-l border-border/60 bg-background/95 shadow-[-8px_0_30px_rgba(0,0,0,0.12)] backdrop-blur-xl will-change-transform motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-reduce:transition-none",
      open ? "translate-x-0" : "translate-x-full",
    )}
    role="dialog"
    aria-modal="false"
    aria-label="Settings"
    use:escapeKey={{ onEscape: handleEscape, delayMs: 50 }}
  >
    <div class="flex h-12 shrink-0 items-center justify-between border-b px-4">
      <h2 class="truncate text-sm font-semibold">Settings</h2>
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

    <div class="shrink-0 border-b px-4 py-3">
      <div
        class="relative grid h-9 grid-cols-3 rounded-lg bg-muted p-1"
        role="tablist"
        aria-label="Settings categories"
      >
        <span
          class="absolute top-1 bottom-1 left-1 rounded-md bg-background shadow-sm motion-safe:transition-transform motion-safe:duration-200 motion-reduce:transition-none"
          style="width: calc((100% - 0.5rem) / 3); transform: translateX({activeTabIndex *
            100}%);"
          aria-hidden="true"
        ></span>
        {#each TABS as tab (tab.id)}
          {@const active = activeTab === tab.id}
          <button
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`settings-panel-${tab.id}`}
            id={`settings-tab-${tab.id}`}
            class={cn(
              "relative z-10 rounded-md text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none",
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
            onclick={() => {
              activeTab = tab.id;
            }}
          >
            {tab.label}
          </button>
        {/each}
      </div>
    </div>

    <div
      id={`settings-panel-${activeTab}`}
      role="tabpanel"
      aria-labelledby={`settings-tab-${activeTab}`}
      class="min-h-0 flex-1 overflow-y-auto p-4"
    >
      <div class="space-y-5">
        {#if activeTab === "theme"}
          <DrawerThemeSection
            currentTheme={project.theme}
            onPreviewTheme={handlePreviewTheme}
            onClearPreviewTheme={clearThemePreview}
            onCommitTheme={(theme: ThemeName) => updateTheme.mutate(theme)}
          />

          <DrawerCodeBackgroundSection
            checked={s.useBlackCodeBackground}
            theme={effTheme}
            onChange={(v) => patch({ useBlackCodeBackground: v })}
          />

          <SettingsSection title="Highlight dim color">
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
          />

          <DrawerPreviewSection
            settings={s}
            {effFontSize}
            {effLineHeight}
            onPatch={patch}
          />

          <DrawerEditorSection {effEditorFontSize} onPatch={patch} />
        {:else}
          <SettingsSection
            title="Global Animations"
            badge={globalMotionActive ? "GLOBAL" : undefined}
          >
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

        <div class="pt-2">
          <button
            type="button"
            class="rounded px-1 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none"
            onclick={() => {
              resetConfirmOpen = true;
            }}
          >
            Reset all settings
          </button>
        </div>
      </div>
    </div>
  </div>
</div>

<ConfirmDialog
  open={resetConfirmOpen}
  title="Reset presentation settings?"
  description="This restores theme, layout, typography, visibility, and motion settings to their defaults."
  confirmLabel="Reset"
  destructive={false}
  onConfirm={resetAllSettings}
  onCancel={() => {
    resetConfirmOpen = false;
  }}
/>
