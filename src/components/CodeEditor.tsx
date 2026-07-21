/**
 * Syntax-highlighted code editor — refactored to single Web Worker pipeline.
 *
 * FIXES:
 * - NSSpellServer timeout: aggressive spellcheck/autocorrect disabling
 * - Triple pipeline removed: previously shikiSync (blocking 2-5ms) + runHighlight (debounced) + plainEscaped (4 regex O(n) per keystroke)
 *   Now: a single Shiki worker pipeline, with the previous rendered result retained while work is pending.
 * - Laggy DebouncedSlider: now uses instant preview Zustand overrides for live SlidePreview.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import {
  resolveProjectLanguage,
  fallbackForeground,
  type Project,
} from "@/types";
import { useUiStore } from "@/store/useUiStore";
import { useSlideCode } from "@/hooks/useSlideCode";
import { setCaretPosition } from "@/store/caretPositions";
import {
  useUpdateSettings,
  useUpdateSlideCode,
} from "@/hooks/queries";
import { record as recordEditorHistory, type Snapshot } from "@/lib/editor-history";
import { markSavePending, clearPendingSave } from "@/lib/code-save";
import { HighlightContextMenu } from "./HighlightContextMenu";
import { useShikiWorker } from "@/hooks/useShikiWorker";
import { useEditorHistory } from "@/hooks/useEditorHistory";
import { useHighlightCrud } from "@/hooks/useHighlightCrud";
import { useCurrentSlide } from "@/hooks/useCurrentSlide";
import { FindReplaceBar } from "./editor/FindReplaceBar";
import { useFindReplace } from "@/hooks/useFindReplace";
import { useCodeEditorCaret } from "@/hooks/editor/useCodeEditorCaret";
import { useCodeEditorScrollSync } from "@/hooks/editor/useCodeEditorScrollSync";
import { useCodeEditorTabKey } from "@/hooks/editor/useCodeEditorTabKey";
import { CodeEditorHeader } from "./editor/CodeEditorHeader";
import { CodeEditorBody } from "./editor/CodeEditorBody";
import { CodeEditorFooter } from "./editor/CodeEditorFooter";

interface CodeEditorProps {
  project: Project;
  expanded?: boolean;
  onToggleExpand?: () => void;
  onCollapse?: () => void;
}

export function CodeEditor({
  project,
  expanded,
  onToggleExpand,
  onCollapse,
}: CodeEditorProps) {
  const setCurrentSlideId = useUiStore((s) => s.setCurrentSlideId);
  const setLocalCode = useUiStore((s) => s.setLocalCode);
  const setSaveStatus = useUiStore((s) => s.setSaveStatus);
  const editorShowLineNumbers = useUiStore((s) => s.editorShowLineNumbers);
  // preview overrides
  const previewProject = useUiStore((s) => s.previewProject);

  const { activeSlide: slide, activeIndex: currentIndex } = useCurrentSlide(project);
  const slideId = slide?.id;

  const code = useSlideCode(slideId, slide?.code ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const editorSnapshotRef = useRef<Snapshot>({ code: "", caretStart: 0, caretEnd: 0 });

  // ── Uncontrolled textarea, by design ─────────────
  const saveCaret = useCodeEditorCaret({ textareaRef, slideId, slide, editorSnapshotRef });

  const [highlightMode, setHighlightMode] = useState(false);
  const codeMutation = useUpdateSlideCode();
  const projectSettingsMutation = useUpdateSettings(project.id);
  const language = resolveProjectLanguage(project);
  const theme = project.theme;

  const rawEditorFontSize = project.settings.editorFontSize || 14;
  const editorFontSize = previewProject.editorFontSize ?? rawEditorFontSize;
  const lineHeight = 1.55;
  const lineCount = useMemo(() => Math.max(1, code.split("\n").length), [code]);
  const lineNumbersText = useMemo(
    () => Array.from({ length: lineCount }, (_, i) => i + 1).join("\n"),
    [lineCount],
  );

  const highlightedHtml = useShikiWorker({
    code,
    language,
    theme,
  });

  const debouncedSave = useDebouncedCallback(
    (id: string, value: string) => {
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
    },
    500,
  );

  useEffect(() => {
    return () => {
      debouncedSave.flush();
    };
  }, [slideId, debouncedSave]);

  const applyCode = useCallback(
    (value: string, beforeOverride?: Snapshot) => {
      if (!slideId) return;
      const el = textareaRef.current;
      const before = beforeOverride ?? editorSnapshotRef.current;
      recordEditorHistory(slideId, before, value);
      const caretStart = el?.selectionStart ?? value.length;
      const caretEnd = el?.selectionEnd ?? caretStart;
      editorSnapshotRef.current = { code: value, caretStart, caretEnd };
      setLocalCode(slideId, value);
      markSavePending(slideId, value);
      debouncedSave(slideId, value);
    },
    [slideId, setLocalCode, debouncedSave],
  );

  const handleChange = applyCode;

  const findReplace = useFindReplace({
    code, textareaRef, applyCode, saveCaret, editorFontSize, lineHeight,
  });
  const { open: isFindOpen, openFind, close: closeFind } = findReplace;


  const { applyHistorySnapshot } = useEditorHistory({ slideId, textareaRef, handleChange, saveCaret });

  const handleTabKey = useCodeEditorTabKey({ slideId, handleChange });

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
        let selection = "";
        try {
          const el = e.currentTarget;
          selection = el.value.slice(el.selectionStart, el.selectionEnd);
        } catch {}
        openFind(selection || undefined);
        return;
      }
      if (e.key === "Escape" && isFindOpen) {
        e.preventDefault();
        closeFind();
        return;
      }
      if (e.key !== "Tab" || !slideId) return;
      handleTabKey(e);
      return;
    },
    [slideId, handleChange, isFindOpen, openFind, closeFind, applyHistorySnapshot, handleTabKey],
  );

  const goSlide = (dir: -1 | 1) => {
    try {
      const el = textareaRef.current;
      if (el && slideId) {
        setCaretPosition(slideId, el.selectionStart, el.selectionEnd);
      }
    } catch {}
    debouncedSave.flush();
    const next = project.slides[currentIndex + dir];
    if (next) setCurrentSlideId(next.id);
  };

  const currentHighlights = slide?.highlights ?? [];
  const crud = useHighlightCrud({ projectId: project.id, slideId, highlights: currentHighlights, code, highlightMode, textareaRef, saveCaret });

  const syncScroll = useCodeEditorScrollSync({ textareaRef, preRef, gutterRef, crud });

  if (!slide) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No slide selected
      </div>
    );
  }

  const gutterWidth = Math.max(2, String(lineCount).length) * 0.65 + 1.25;

  const defaultFg = fallbackForeground(theme);

  return (
    <div className="flex h-full min-w-0 flex-col bg-card">
      <CodeEditorHeader
        project={project}
        currentIndex={currentIndex}
        language={language}
        highlightMode={highlightMode}
        highlightCount={currentHighlights.length}
        expanded={expanded}
        onNavigate={goSlide}
        onLanguageChange={(value) => projectSettingsMutation.mutate({ language: value })}
        onToggleHighlightMode={() => setHighlightMode((v) => !v)}
        onToggleExpand={onToggleExpand}
        onCollapse={onCollapse}
        onToggleFind={() => (isFindOpen ? closeFind() : openFind())}
      />

      {isFindOpen && <FindReplaceBar fr={findReplace} onClose={closeFind} />}

      <CodeEditorBody
        editorShowLineNumbers={editorShowLineNumbers}
        gutterWidth={gutterWidth}
        editorFontSize={editorFontSize}
        lineHeight={lineHeight}
        lineNumbersText={lineNumbersText}
        highlightedHtml={highlightedHtml}
        defaultFg={defaultFg}
        code={code}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onKeyUp={crud.onKeyUp}
        onSelect={crud.onSelect}
        onMouseUp={crud.onMouseUp}
        onBlur={saveCaret}
        onScroll={syncScroll}
        onContextMenu={crud.onContextMenu}
        gutterRef={gutterRef}
        preRef={preRef}
        textareaRef={textareaRef}
      />

      <HighlightContextMenu
        visible={crud.contextMenu.visible}
        position={crud.contextMenu.position}
        onAddHighlight={crud.addPendingHighlight}
        onClose={crud.closeContextMenu}
      />

      <CodeEditorFooter
        project={project}
        slide={slide}
        highlightMode={highlightMode}
        currentHighlights={currentHighlights}
        code={code}
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
  );
}