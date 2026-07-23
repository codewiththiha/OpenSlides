<script lang="ts">
  /**
   * Syntax-highlighted code editor — single Web Worker Shiki pipeline.
   *
   * React notes preserved:
   * - NSSpellServer timeout: aggressive spellcheck/autocorrect disabling
   * - The textarea is uncontrolled (useCodeEditorCaret syncs value/caret).
   * - Debounced save: 500ms timer in this component (replaces use-debounce),
   *   flushed on slide switch / unmount / explicit navigation so the final
   *   edit is never discarded by a disposed timer.
   * - Setter-style Zustand preview overrides gave instant slider feedback;
   *   here ui.previewProject / previewSlides / previewHighlights (SvelteMap)
   *   do the same through $derived.
   */
  import {
    resolveProjectLanguage,
    fallbackForeground,
    type Project,
  } from "@/types";
  import {
    ui,
    setCurrentSlideId,
    setSaveStatus,
  } from "@/store/ui-state.svelte";
  import { untrack } from "svelte";
  import { localCode, setLocalCode } from "@/store/slide-code.svelte";
  import { setCaretPosition } from "@/store/caretPositions";
  import { useUpdateSettings, useUpdateSlideCode } from "@/queries";
  import { record as recordEditorHistory, type Snapshot } from "@/lib/editor-history";
  import { markSavePending, clearPendingSave } from "@/lib/code-save";
  import HighlightContextMenu from "./HighlightContextMenu.svelte";
  import { useShikiWorker } from "@/hooks/useShikiWorker";
  import { useEditorHistory } from "@/hooks/useEditorHistory.svelte";
  import { useHighlightCrud } from "@/hooks/useHighlightCrud.svelte";
  import { useCurrentSlide } from "@/hooks/useCurrentSlide.svelte";
  import FindReplaceBar from "./editor/FindReplaceBar.svelte";
  import { useFindReplace } from "@/hooks/useFindReplace.svelte";
  import { useCodeEditorCaret } from "@/hooks/editor/useCodeEditorCaret.svelte";
  import { useCodeEditorScrollSync } from "@/hooks/editor/useCodeEditorScrollSync";
  import { useCodeEditorTabKey } from "@/hooks/editor/useCodeEditorTabKey";
  import CodeEditorHeader from "./editor/CodeEditorHeader.svelte";
  import CodeEditorBody from "./editor/CodeEditorBody.svelte";
  import CodeEditorFooter from "./editor/CodeEditorFooter.svelte";

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

  const currentSlide = useCurrentSlide(() => project);
  const slide = $derived(currentSlide.activeSlide);
  const currentIndex = $derived(currentSlide.activeIndex);
  const slideId = $derived(slide?.id);

  const code = $derived(slide ? (localCode[slide.id] ?? slide.code) : "");

  let textareaEl = $state<HTMLTextAreaElement | null>(null);
  let preEl = $state<HTMLPreElement | null>(null);
  let gutterEl = $state<HTMLDivElement | null>(null);
  /** Plain mutable ref-object (React useRef equivalent) — no reactivity needed. */
  const editorSnapshot = { current: { code: "", caretStart: 0, caretEnd: 0 } as Snapshot };

  // ── Uncontrolled textarea, by design ─────────────
  const saveCaret = useCodeEditorCaret({
    textarea: () => textareaEl,
    slideId: () => slideId,
    slide: () => slide,
    editorSnapshot,
  });

  let highlightMode = $state(false);
  const codeMutation = useUpdateSlideCode();
  // Stable per mount (the editor is rebuilt on project switch) — untrack()
  // marks the one-time id capture as deliberate.
  const projectId = untrack(() => project.id);
  const projectSettingsMutation = useUpdateSettings(projectId);
  const language = $derived(resolveProjectLanguage(project));
  const theme = $derived(project.theme);

  const rawEditorFontSize = $derived(project.settings.editorFontSize || 14);
  const editorFontSize = $derived(
    ui.previewProject.editorFontSize ?? rawEditorFontSize,
  );
  const lineHeight = 1.55;
  const lineCount = $derived(Math.max(1, code.split("\n").length));
  const lineNumbersText = $derived(
    Array.from({ length: lineCount }, (_, i) => i + 1).join("\n"),
  );

  const shiki = useShikiWorker(() => ({
    code,
    language,
    theme,
    resetKey: slideId,
  }));

  // ── 500ms debounced save (was use-debounce) ─────────────
  const SAVE_DEBOUNCE_MS = 500;
  let saveTimer: number | undefined;
  let pendingSave: { id: string; value: string } | null = null;

  function runSave(id: string, value: string) {
    setSaveStatus("saving");
    codeMutation.mutate(
      { slideId: id, code: value },
      {
        onSuccess: () => {
          setSaveStatus("saved");
          clearPendingSave(id, value);
        },
        onError: () => setSaveStatus("error"),
      },
    );
  }

  function debouncedSave(id: string, value: string) {
    pendingSave = { id, value };
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      const p = pendingSave;
      pendingSave = null;
      saveTimer = undefined;
      if (p) runSave(p.id, p.value);
    }, SAVE_DEBOUNCE_MS);
  }

  /** use-debounce's flush(): run the pending edit immediately, if any. */
  function flushSave() {
    if (saveTimer !== undefined && pendingSave) {
      window.clearTimeout(saveTimer);
      saveTimer = undefined;
      const { id, value } = pendingSave;
      pendingSave = null;
      runSave(id, value);
    }
  }

  $effect(() => {
    // A slide switch or editor unmount must persist the final debounced edit
    // before disposing its timer. This cleanup runs for both cases.
    void slideId;
    return () => {
      flushSave();
    };
  });

  function applyCode(value: string, beforeOverride?: Snapshot) {
    if (!slideId) return;
    const el = textareaEl;
    const before = beforeOverride ?? editorSnapshot.current;
    const caretStart = el?.selectionStart ?? value.length;
    const caretEnd = el?.selectionEnd ?? caretStart;
    const after = { code: value, caretStart, caretEnd };
    recordEditorHistory(slideId, before, after);
    editorSnapshot.current = after;
    setLocalCode(slideId, value);
    markSavePending(slideId, value);
    debouncedSave(slideId, value);
  }

  const handleChange = applyCode;

  const findReplace = useFindReplace({
    code: () => code,
    textarea: () => textareaEl,
    applyCode,
    saveCaret,
    editorFontSize: () => editorFontSize,
    lineHeight: () => lineHeight,
  });
  const isFindOpen = $derived(findReplace.open);
  const { close: closeFind } = findReplace;
  const openFind = findReplace.openFind;

  $effect(() => {
    const openCodeFind = (event: Event) => {
      const query = (event as CustomEvent<{ query?: string }>).detail?.query;
      openFind(query);
    };
    window.addEventListener("openslides:find-in-code", openCodeFind);
    return () => window.removeEventListener("openslides:find-in-code", openCodeFind);
  });

  const { applyHistorySnapshot } = useEditorHistory({
    slideId: () => slideId,
    textarea: () => textareaEl,
    handleChange,
    saveCaret,
  });

  const handleTabKey = useCodeEditorTabKey({ slideId: () => slideId, handleChange });

  function handleKeyDown(e: KeyboardEvent & { currentTarget: HTMLTextAreaElement }) {
    const isMod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    if (isMod && (key === "z" || key === "y")) {
      e.preventDefault();
      const direction = key === "y" || (key === "z" && e.shiftKey) ? "redo" : "undo";
      if (!applyHistorySnapshot(direction)) {
        document.execCommand(direction);
      }
      return;
    }
    if (isMod && key === "f" && !e.shiftKey) {
      e.preventDefault();
      window.dispatchEvent(new Event("openslides:open-search"));
      return;
    }
    if (e.key === "Escape" && isFindOpen) {
      e.preventDefault();
      closeFind();
      return;
    }
    if (e.key !== "Tab" || !slideId) return;
    handleTabKey(e);
  }

  function goSlide(dir: -1 | 1) {
    try {
      const el = textareaEl;
      if (el && slideId) {
        setCaretPosition(slideId, el.selectionStart, el.selectionEnd);
      }
    } catch {
      /* ignore */
    }
    flushSave();
    const next = project.slides[currentIndex + dir];
    if (next) setCurrentSlideId(next.id);
  }

  const currentHighlights = $derived(slide?.highlights ?? []);
  const crud = useHighlightCrud({
    projectId,
    slideId: () => slideId,
    highlights: () => currentHighlights,
    code: () => code,
    highlightMode: () => highlightMode,
    textarea: () => textareaEl,
    saveCaret,
  });

  const syncScroll = useCodeEditorScrollSync({
    textarea: () => textareaEl,
    pre: () => preEl,
    gutter: () => gutterEl,
    crud,
  });

  const gutterWidth = $derived(Math.max(2, String(lineCount).length) * 0.65 + 1.25);
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
      {highlightMode}
      highlightCount={currentHighlights.length}
      {expanded}
      onNavigate={goSlide}
      onLanguageChange={(value) => projectSettingsMutation.mutate({ language: value })}
      onToggleHighlightMode={() => (highlightMode = !highlightMode)}
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
      bind:gutterEl
      bind:preEl
      bind:textareaEl
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
      {highlightMode}
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
