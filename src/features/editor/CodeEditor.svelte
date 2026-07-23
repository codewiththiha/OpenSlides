<script lang="ts">
  /**
   * Syntax-highlighted code editor — single Web Worker Shiki pipeline.
   *
   * - The textarea is uncontrolled (createCaretSync syncs value/caret).
   * - Save: 500ms debounce in createCodeSave, flushed on slide switch,
   *   unmount, and explicit navigation so the final edit is never lost.
   * - Instant slider feedback comes from preview overrides
   *   (ui.previewProject / previewSlides / previewHighlights) read via
   *   $derived.
   */
  import {
    resolveProjectLanguage,
    fallbackForeground,
    type Project,
  } from "$lib/types";
  import { ui } from "$lib/stores/ui-state.svelte";
  import { previewProjectSetting } from "@/features/settings/preview-settings";
  import HighlightContextMenu from "@/features/highlights/HighlightContextMenu.svelte";
  import { untrack } from "svelte";
  import { createCodeEditorState } from "./code-editor-state.svelte";
  import { createCodeSave } from "./save.svelte";
  import { effectiveSlideCode } from "$lib/stores/slide-code.svelte";
  import { updateProjectSettingsMutation } from "$lib/queries";
  import { editorShikiHtml } from "$lib/shiki/shiki-display.svelte";
  import { createCurrentSlide } from "@/features/slides/current-slide.svelte";
  import { createCaretSync } from "@/features/editor/caret.svelte";
  import { createScrollSync } from "@/features/editor/scroll-sync";
  import { createCodeEditorApply } from "./code-editor/code-editor-apply.svelte";
  import { createCodeEditorFind } from "./code-editor/code-editor-find.svelte";
  import { createCodeEditorKeyboard } from "./code-editor/code-editor-keyboard.svelte";
  import { createCodeEditorHighlighting } from "./code-editor/code-editor-highlighting.svelte";
  import { createCodeEditorSlideNav } from "./code-editor/code-editor-slide-nav.svelte";
  import FindReplaceBar from "@/features/editor/FindReplaceBar.svelte";
  import CodeEditorHeader from "@/features/editor/CodeEditorHeader.svelte";
  import CodeEditorBody from "@/features/editor/CodeEditorBody.svelte";
  import CodeEditorFooter from "@/features/editor/CodeEditorFooter.svelte";

  let {
    project,
    expanded,
    onToggleExpand,
    onCollapse,
  }: {
    project: Project;
    expanded?: boolean;
    onToggleExpand?: () => void;
    onCollapse?: () => void;
  } = $props();

  const currentSlide = createCurrentSlide(() => project);
  const slide = $derived(currentSlide.activeSlide);
  const currentIndex = $derived(currentSlide.activeIndex);
  const slideId = $derived(slide?.id);

  const code = $derived(effectiveSlideCode(slide));

  const st = createCodeEditorState();

  // ── Uncontrolled textarea, by design ─────────────
  const saveCaret = createCaretSync({
    textarea: () => st.textareaEl,
    slideId: () => slideId,
    slide: () => slide,
    editorSnapshot: st.editorSnapshot,
  });

  // Stable per mount (the editor is rebuilt on project switch) — untrack()
  // marks the one-time id capture as deliberate.
  const projectId = untrack(() => project.id);
  const projectSettingsMutation = updateProjectSettingsMutation(projectId);
  const language = $derived(resolveProjectLanguage(project));
  const theme = $derived(project.theme);

  const rawEditorFontSize = $derived(project.settings.editorFontSize || 14);
  const editorFontSize = $derived(
    previewProjectSetting("editorFontSize") ?? rawEditorFontSize,
  );
  const lineHeight = 1.55;
  const lineCount = $derived(Math.max(1, code.split("\n").length));
  const lineNumbersText = $derived(
    Array.from({ length: lineCount }, (_, i) => i + 1).join("\n"),
  );

  const shiki = editorShikiHtml(() => ({
    code,
    language,
    theme,
    resetKey: slideId,
  }));

  const save = createCodeSave({ slideId: () => slideId });

  const { applyCode: handleChange } = createCodeEditorApply({
    slideId: () => slideId,
    textareaEl: () => st.textareaEl,
    editorSnapshot: st.editorSnapshot,
    save,
  });

  const { findReplace, isFindOpen, closeFind, openFind } = createCodeEditorFind(
    {
      code: () => code,
      textareaEl: () => st.textareaEl,
      applyCode: handleChange,
      saveCaret,
      editorFontSize: () => editorFontSize,
      lineHeight: () => lineHeight,
    },
  );

  const { handleKeyDown } = createCodeEditorKeyboard({
    slideId: () => slideId,
    textareaEl: () => st.textareaEl,
    handleChange,
    saveCaret,
    isFindOpen: () => isFindOpen,
    closeFind,
  });

  const { goSlide } = createCodeEditorSlideNav({
    slides: () => project.slides,
    currentIndex: () => currentIndex,
    slideId: () => slideId,
    textareaEl: () => st.textareaEl,
    save,
  });

  const currentHighlights = $derived(slide?.highlights ?? []);
  const crud = createCodeEditorHighlighting({
    projectId,
    slideId: () => slideId,
    highlights: () => currentHighlights,
    code: () => code,
    highlightMode: () => st.highlightMode,
    textareaEl: () => st.textareaEl,
    saveCaret,
  });

  const syncScroll = createScrollSync({
    textarea: () => st.textareaEl,
    pre: () => st.preEl,
    gutter: () => st.gutterEl,
    crud,
  });

  const gutterWidth = $derived(
    Math.max(2, String(lineCount).length) * 0.65 + 1.25,
  );
  const defaultFg = $derived(fallbackForeground(theme));
</script>

{#if !slide}
  <div class="flex h-full items-center justify-center text-muted-foreground">
    No slide selected
  </div>
{:else}
  <div class="flex h-full min-w-0 flex-col bg-card">
    <CodeEditorHeader
      {project}
      {currentIndex}
      {language}
      highlightMode={st.highlightMode}
      highlightCount={currentHighlights.length}
      {expanded}
      onNavigate={goSlide}
      onLanguageChange={(value) =>
        projectSettingsMutation.mutate({ language: value })}
      onToggleHighlightMode={() => (st.highlightMode = !st.highlightMode)}
      {onToggleExpand}
      {onCollapse}
      onToggleFind={() => (isFindOpen ? closeFind() : openFind())}
    />

    {#if isFindOpen}
      <FindReplaceBar fr={findReplace} onClose={closeFind} />
    {/if}

    <CodeEditorBody
      editorShowLineNumbers={ui.editorShowLineNumbers}
      {gutterWidth}
      {editorFontSize}
      {lineHeight}
      {lineNumbersText}
      highlightedHtml={shiki.html}
      {defaultFg}
      {code}
      onChange={(value) => handleChange(value)}
      onKeyDown={handleKeyDown}
      onKeyUp={(e) => crud.onKeyUp(e)}
      onSelect={() => crud.onSelect()}
      onMouseUp={(e) => crud.onMouseUp(e)}
      onBlur={saveCaret}
      onScroll={syncScroll}
      onContextMenu={(e) => crud.onContextMenu(e)}
      bind:gutterEl={st.gutterEl}
      bind:preEl={st.preEl}
      bind:textareaEl={st.textareaEl}
    />

    <HighlightContextMenu
      visible={crud.contextMenu.visible}
      position={crud.contextMenu.position}
      onAddHighlight={crud.addPendingHighlight}
      onClose={crud.closeContextMenu}
    />

    <CodeEditorFooter
      {project}
      {slide}
      highlightMode={st.highlightMode}
      {currentHighlights}
      {code}
      expandedId={crud.expandedHighlightId}
      previewIndex={crud.previewHighlightIndex}
      onToggleExpand={crud.toggleExpanded}
      onUpdate={crud.updateHighlight}
      onDelete={crud.deleteHighlight}
      onPreview={crud.previewHighlight}
      onMove={crud.moveHighlight}
      onReorder={crud.reorderHighlights}
    />
  </div>
{/if}
