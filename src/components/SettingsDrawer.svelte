<script lang="ts">
  /**
   * Right-side settings drawer for global project options.
   * Preview line numbers (slide view) are separate from editor gutter numbers.
   * fontSize / lineHeight / editorFontSize / global durations update the
   * preview instantly via previewProject overrides (Zustand → runes), while
   * DB save happens only on commit.
   */
  import { X } from "lucide-svelte";
  import Button from "./ui/Button.svelte";
  import { type Project, type ThemeName } from "@/types";
  import { useUpdateSettings, useUpdateTheme } from "@/queries";
  import {
    ui,
    setEditorShowLineNumbers,
    setShowSlideHoverPreview,
    setPreviewProjectSetting,
    clearPreviewProjectSetting,
  } from "@/store/ui-state.svelte";
  import { previewProjectSettings } from "@/hooks/usePreviewSettings";
  import { cn } from "@/lib/utils";
  import { showUndoToast } from "@/lib/settings-undo";
  import { Z_INDEX } from "./ui/Overlay.svelte";
  import SettingsSection from "./ui/SettingsSection.svelte";
  import SliderField from "./ui/SliderField.svelte";
  import ToggleField from "./ui/ToggleField.svelte";
  import CodeAlignPicker from "./settings/CodeAlignPicker.svelte";
  import GlobalAnimationSection from "./settings/GlobalAnimationSection.svelte";
  import ThemeGridPicker from "./settings/ThemeGridPicker.svelte";

  let {
    project,
    open,
    onClose,
  }: {
    project: Project;
    open: boolean;
    onClose: () => void;
  } = $props();

  const updateSettings = useUpdateSettings(project.id);
  const updateTheme = useUpdateTheme(project.id);

  const previewProject = $derived(previewProjectSettings());

  $effect(() => {
    if (!open) clearPreviewProjectSetting("theme");
  });

  const s = $derived(project.settings);

  // effective values (preview wins)
  const effFontSize = $derived(previewProject.fontSize ?? s.fontSize);
  const effLineHeight = $derived(previewProject.lineHeight ?? s.lineHeight);
  const effEditorFontSize = $derived(previewProject.editorFontSize ?? s.editorFontSize);
  const effGlobalTransition = $derived(
    previewProject.globalTransitionDuration ?? s.globalTransitionDuration,
  );
  const effGlobalStagger = $derived(previewProject.globalStagger ?? s.globalStagger);

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
    "fixed right-0 top-0 flex h-full w-[340px] flex-col border-l bg-card shadow-2xl transition-transform duration-200",
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
    <SettingsSection title="Theme" description="Choose a syntax theme from its live code preview.">
      <ThemeGridPicker
        value={project.theme}
        onPreviewTheme={(theme) => setPreviewProjectSetting("theme", theme)}
        onClearPreviewTheme={() => clearPreviewProjectSetting("theme")}
        onChange={(theme) => {
          clearPreviewProjectSetting("theme");
          updateTheme.mutate(theme as ThemeName);
        }}
      />
    </SettingsSection>

    <SettingsSection
      title="Code layout"
      description="Where the code block sits on your slides. Applies to all slides."
    >
      <CodeAlignPicker value={s.codeAlign ?? "left"} onChange={(align) => patch({ codeAlign: align })} />
    </SettingsSection>

    <SettingsSection title="Code background">
      <ToggleField
        label="Pure black background"
        description="Replace the syntax theme background with black for easy video compositing"
        checked={s.useBlackCodeBackground}
        onChange={(v) => {
          setPreviewProjectSetting("useBlackCodeBackground", v);
          patch({ useBlackCodeBackground: v });
        }}
      />
    </SettingsSection>

    <SettingsSection title="Line numbers">
      <ToggleField
        label="Slide preview"
        description="Shown during preview / presentation"
        checked={s.showLineNumbers}
        onChange={(v) => patch({ showLineNumbers: v })}
      />
      <ToggleField
        label="Highlight step control"
        description="Show the floating highlight progress control in preview and presentation"
        checked={s.showHighlightStepIndicator}
        onChange={(v) => patch({ showHighlightStepIndicator: v })}
      />
      <ToggleField
        label="Code editor"
        description="Line numbers in the code editor"
        checked={ui.editorShowLineNumbers}
        onChange={(next) => {
          const before = ui.editorShowLineNumbers;
          setEditorShowLineNumbers(next);
          showUndoToast(
            "undo-editor-showLineNumbers",
            next ? "Editor line numbers on" : "Editor line numbers off",
            () => setEditorShowLineNumbers(before),
          );
        }}
      />
      <ToggleField
        label="Slide hover previews"
        description="Show a larger preview when you hover over a slide"
        checked={ui.showSlideHoverPreview}
        onChange={setShowSlideHoverPreview}
      />

      <div class="pt-2">
        <SliderField
          label="Preview font size"
          labelClassName="text-xs text-muted-foreground"
          value={effFontSize}
          min={12}
          max={32}
          step={2}
          format={(v) => `${v}px`}
          onPreview={(v) => setPreviewProjectSetting("fontSize", v)}
          onCommit={(v) => patch({ fontSize: v })}
        />
      </div>

      <div>
        <SliderField
          label="Line height"
          labelClassName="text-xs text-muted-foreground"
          value={effLineHeight}
          min={1.1}
          max={2.2}
          step={0.05}
          format={(v) => v.toFixed(2)}
          onPreview={(v) => setPreviewProjectSetting("lineHeight", v)}
          onCommit={(v) => patch({ lineHeight: v })}
        />
      </div>

      <div>
        <SliderField
          label="Editor font size"
          labelClassName="text-xs text-muted-foreground"
          value={effEditorFontSize}
          min={11}
          max={22}
          step={1}
          format={(v) => `${v}px`}
          onPreview={(v) => setPreviewProjectSetting("editorFontSize", v)}
          onCommit={(v) => patch({ editorFontSize: v })}
        />
      </div>
    </SettingsSection>

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
        onPreview={setPreviewProjectSetting}
        onCommit={patch}
      />
    </SettingsSection>
  </div>
</aside>
