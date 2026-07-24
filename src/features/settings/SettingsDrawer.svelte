<script lang="ts">
  /**
   * Right-side settings drawer for global project options (§6.9):
   * a shell owning the mutations; each settings section is a component
   * under ./drawer/.
   */
  import { untrack } from "svelte";
  import { X } from "@lucide/svelte";
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
  import type { GlobalAnimationKey, PreviewProjectSettings } from "$lib/stores/types";
  import { previewProjectSettings } from "@/features/settings/preview-settings";
  import { cn } from "$lib/lib/utils";
  import { Z_INDEX } from "$lib/ui/Overlay.svelte";
  import SettingsSection from "$lib/ui/SettingsSection.svelte";
  import GlobalAnimationSection from "@/features/settings/GlobalAnimationSection.svelte";
  import DrawerThemeSection from "./drawer/DrawerThemeSection.svelte";
  import DrawerCodeLayoutSection from "./drawer/DrawerCodeLayoutSection.svelte";
  import DrawerCodeBackgroundSection from "./drawer/DrawerCodeBackgroundSection.svelte";
  import DrawerLineNumbersSection from "./drawer/DrawerLineNumbersSection.svelte";

  let {
    project,
    open,
    onClose,
  }: {
    project: Project;
    open: boolean;
    onClose: () => void;
  } = $props();

  // The drawer is mounted under the project-keyed EditorInner, so project.id
  // is stable for this mount — untrack() marks the one-time capture.
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
    (previewProject.highlightDimColor ?? s.highlightDimColor ?? "black") as "black" | "theme",
  );

  function patch(partial: Parameters<typeof updateSettings.mutate>[0]) {
    updateSettings.mutate(partial);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
  class={cn(
    "fixed inset-0 bg-black/40 transition-opacity",
    open ? "opacity-100" : "pointer-events-none opacity-0",
  )}
  style="z-index: {Z_INDEX.drawerBackdrop};"
  onclick={onClose}
></div>
<aside
  class={cn(
    "fixed top-0 right-0 flex h-full w-[340px] flex-col border-l bg-card shadow-2xl transition-transform duration-200",
    open ? "translate-x-0" : "translate-x-full",
  )}
  style="z-index: {Z_INDEX.drawer};"
>
  <div class="flex h-12 items-center justify-between border-b px-4">
    <h2 class="text-sm font-semibold">Presentation Settings</h2>
    <Button variant="ghost" size="icon" class="h-8 w-8" onclick={onClose}>
      <X class="h-4 w-4" />
    </Button>
  </div>

  <div class="flex-1 space-y-6 overflow-y-auto p-4">
    <DrawerThemeSection
      currentTheme={project.theme}
      onCommitTheme={(theme: ThemeName) => updateTheme.mutate(theme)}
    />

    <DrawerCodeLayoutSection
      value={s.codeAlign ?? "left"}
      onChange={(align) => patch({ codeAlign: align })}
    />

    <DrawerCodeBackgroundSection
      checked={s.useBlackCodeBackground}
      onChange={(v) => patch({ useBlackCodeBackground: v })}
    />

    <DrawerLineNumbersSection settings={s} onPatch={patch} />

    <SettingsSection
      title="Global Animations"
      description="When on, every slide uses these animation values and the per-slide sliders are locked."
      borderTop
    >
      <p class="text-[11px] text-muted-foreground">
        Stagger is the delay between each animated character.
      </p>
      <GlobalAnimationSection
        settings={s}
        effTransition={effGlobalTransition}
        effStagger={effGlobalStagger}
        effGlobalDimAmount={effGlobalDimAmount}
        effGlobalSizeUpAmount={effGlobalSizeUpAmount}
        effHighlightDimColor={effHighlightDimColor}
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
  </div>
</aside>
