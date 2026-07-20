/**
 * Syntax-highlighted code editor — refactored to single Web Worker pipeline.
 *
 * FIXES:
 * - NSSpellServer timeout: aggressive spellcheck/autocorrect disabling
 * - Triple pipeline removed: previously shikiSync (blocking 2-5ms) + runHighlight (debounced) + plainEscaped (4 regex O(n) per keystroke)
 *   Now: a single Shiki worker pipeline, with the previous rendered result retained while work is pending.
 * - Laggy DebouncedSlider: now uses instant preview Zustand overrides for live SlidePreview.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Maximize2,
  Minimize2,
  PanelRightClose,
  Highlighter as HighlighterIcon,
  Search,
  WrapText,
} from "lucide-react";
import { useDebouncedCallback } from "use-debounce";
import {
  LIGHT_THEMES,
  SUPPORTED_LANGUAGES,
  resolveProjectLanguage,
  type Project,
  type Highlight,
} from "@/types";
import { useUiStore } from "@/store/useUiStore";
import { useLocalCodeAtom, getLocalCodeAtom } from "@/store/localCodeAtoms";
import { getCaretPosition, setCaretPosition } from "@/store/caretPositions";
import {
  useUpdateSettings,
  useUpdateSlideCode,
  useUpdateSlideSettings,
} from "@/hooks/queries";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { selectionToRange } from "@/lib/highlight-tokens";
import { record as recordEditorHistory, type Snapshot } from "@/lib/editor-history";
import { markSavePending, clearPendingSave } from "@/lib/code-save";
import { HighlightContextMenu } from "./HighlightContextMenu";
import { HighlightSettingsPanel } from "./HighlightSettingsPanel";
import { createDefaultHighlight } from "@/lib/highlight-utils";
import { useShikiWorker } from "@/hooks/useShikiWorker";
import { EditorSlideNav } from "./editor/EditorSlideNav";
import { useEditorHistory } from "@/hooks/useEditorHistory";
import { FindReplaceBar } from "./editor/FindReplaceBar";
import { SlideTimingSliders } from "./editor/SlideTimingSliders";
import { useFindReplace } from "@/hooks/useFindReplace";

interface CodeEditorProps {
  project: Project;
  expanded?: boolean;
  onToggleExpand?: () => void;
  onCollapse?: () => void;
}

const TAB_SPACES = "  ";

export function CodeEditor({
  project,
  expanded,
  onToggleExpand,
  onCollapse,
}: CodeEditorProps) {
  const currentSlideId = useUiStore((s) => s.currentSlideId);
  const setCurrentSlideId = useUiStore((s) => s.setCurrentSlideId);
  const setLocalCode = useUiStore((s) => s.setLocalCode);
  const setSaveStatus = useUiStore((s) => s.setSaveStatus);
  const editorShowLineNumbers = useUiStore((s) => s.editorShowLineNumbers);
  const previewHighlightIndex = useUiStore((s) => s.previewHighlightIndex);
  const setPreviewHighlightIndex = useUiStore(
    (s) => s.setPreviewHighlightIndex,
  );
  // preview overrides
  const previewProject = useUiStore((s) => s.previewProject);
  const clearPreviewHighlightSetting = useUiStore((s) => s.clearPreviewHighlightSetting);

  const slideMap = useMemo(() => {
    const sMap = new Map<string, (typeof project.slides)[number]>();
    const iMap = new Map<string, number>();
    project.slides.forEach((s, i) => {
      sMap.set(s.id, s);
      iMap.set(s.id, i);
    });
    return { sMap, iMap };
  }, [project.slides]);

  const slide =
    (currentSlideId ? slideMap.sMap.get(currentSlideId) : undefined) ??
    project.slides[0];
  const slideId = slide?.id;

  const localCodeAtom = useLocalCodeAtom(slideId);
  const code = localCodeAtom ?? slide?.code ?? "";
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const editorSnapshotRef = useRef<Snapshot>({ code: "", caretStart: 0, caretEnd: 0 });

  // ── Uncontrolled textarea, by design ─────────────
  // Fix Caret Restoration Flash: useLayoutEffect fires synchronously after DOM mutation
  // but before browser paint, so caret never flashes to end before snapping back.
  // Previously rAF caused a one-frame flash when switching slides fast.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el || !slideId) return;
    const next = getLocalCodeAtom(slideId) ?? slide?.code ?? "";
    const isNewValue = el.value !== next;
    if (isNewValue) {
      // Synchronous value update in same microtask as caret restore
      el.value = next;
    }
    const saved = getCaretPosition(slideId);
    if (saved) {
      const len = next.length;
      const start = Math.min(Math.max(saved.start, 0), len);
      const end = Math.min(Math.max(saved.end, 0), len);
      try {
        // Synchronous caret restore before paint — no flash
        el.selectionStart = start;
        el.selectionEnd = end;
      } catch {}
    } else {
      if (isNewValue) {
        try {
          // Place at end only when value actually changed and no saved pos
          el.selectionStart = el.selectionEnd = next.length;
        } catch {}
      }
    }
    editorSnapshotRef.current = {
      code: next,
      caretStart: el.selectionStart,
      caretEnd: el.selectionEnd,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideId]);

  const saveCaret = useCallback(() => {
    const el = textareaRef.current;
    if (!el || !slideId) return;
    try {
      setCaretPosition(slideId, el.selectionStart, el.selectionEnd);
      editorSnapshotRef.current = {
        ...editorSnapshotRef.current,
        caretStart: el.selectionStart,
        caretEnd: el.selectionEnd,
      };
    } catch {}
  }, [slideId, setCaretPosition]);

  const [highlightMode, setHighlightMode] = useState(false);
  const [wrapLines, setWrapLines] = useState(false);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [pendingSelection, setPendingSelection] = useState<{
    startLine: number; startChar: number; endLine: number; endChar: number;
  } | null>(null);
  const [expandedHighlightId, setExpandedHighlightId] = useState<string | null>(null);
  const codeMutation = useUpdateSlideCode();
  const settingsMutation = useUpdateSlideSettings(project.id);
  const projectSettingsMutation = useUpdateSettings(project.id);
  const language = resolveProjectLanguage(project);
  const theme = project.theme;
  const isDarkBg = !LIGHT_THEMES.has(theme);
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
    isDark: isDarkBg,
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
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const value = el.value;
      const beforeSnapshot: Snapshot = { code: value, caretStart: start, caretEnd: end };

      if (e.shiftKey) {
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        const before = value.slice(0, lineStart);
        let line = value.slice(lineStart);
        let removed = 0;
        if (line.startsWith(TAB_SPACES)) {
          line = line.slice(TAB_SPACES.length);
          removed = TAB_SPACES.length;
        } else if (line.startsWith("\t")) {
          line = line.slice(1);
          removed = 1;
        }
        const next = before + line;
        // Synchronous value + caret update in same microtask (no rAF flash)
        el.value = next;
        const pos = Math.max(lineStart, start - removed);
        try {
          el.selectionStart = el.selectionEnd = pos;
        } catch {}
        handleChange(next, beforeSnapshot);
        return;
      }

      const next = value.slice(0, start) + TAB_SPACES + value.slice(end);
      // Synchronous update guarantees caret positioning happens in exact same microtask as value update
      el.value = next;
      const pos = start + TAB_SPACES.length;
      try {
        el.selectionStart = el.selectionEnd = pos;
      } catch {}
      handleChange(next, beforeSnapshot);
    },
    [slideId, handleChange, isFindOpen, openFind, closeFind, applyHistorySnapshot],
  );

  const syncScroll = () => {
    setContextMenuVisible(false);
    if (!textareaRef.current) return;
    const top = textareaRef.current.scrollTop;
    const left = textareaRef.current.scrollLeft;
    if (preRef.current) {
      preRef.current.scrollTop = top;
      preRef.current.scrollLeft = left;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = top;
    }
  };

  const currentIndex = slideId ? (slideMap.iMap.get(slideId) ?? -1) : -1;

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

  // Highlight CRUD
  const currentHighlights = slide?.highlights ?? [];

  const showHighlightMenuAt = useCallback(
    (x: number, y: number) => {
      if (!highlightMode) return;
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      if (start === end) return;

      setPendingSelection(selectionToRange(code, start, end));
      const menuWidth = 180;
      const menuHeight = 84;
      setContextMenuPosition({
        x: Math.min(Math.max(8, x), Math.max(8, window.innerWidth - menuWidth - 8)),
        y: Math.min(Math.max(8, y - menuHeight), Math.max(8, window.innerHeight - menuHeight - 8)),
      });
      setContextMenuVisible(true);
    },
    [highlightMode, code],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!highlightMode) return;
      e.preventDefault();
      showHighlightMenuAt(e.clientX, e.clientY);
    },
    [highlightMode, showHighlightMenuAt],
  );

  const handleSelect = useCallback(() => {
    saveCaret();
    const textarea = textareaRef.current;
    if (textarea && textarea.selectionStart === textarea.selectionEnd) {
      setContextMenuVisible(false);
    }
  }, [saveCaret]);

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLTextAreaElement>) => {
      saveCaret();
      if (e.button === 0 && highlightMode) {
        pointerRef.current = { x: e.clientX, y: e.clientY };
        const textarea = textareaRef.current;
        if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
          showHighlightMenuAt(e.clientX, e.clientY);
        }
      }
    },
    [highlightMode, saveCaret, showHighlightMenuAt],
  );

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      saveCaret();
      if (!e.shiftKey || !highlightMode || contextMenuVisible) return;
      const textarea = textareaRef.current;
      if (!textarea || textarea.selectionStart === textarea.selectionEnd) return;
      const rect = textarea.getBoundingClientRect();
      showHighlightMenuAt(rect.left + rect.width / 2 - 90, rect.top + 8);
    },
    [contextMenuVisible, highlightMode, saveCaret, showHighlightMenuAt],
  );

  const handleAddHighlight = useCallback(() => {
    if (!pendingSelection || !slideId) return;
    const newHl = createDefaultHighlight(
      pendingSelection.startLine,
      pendingSelection.startChar,
      pendingSelection.endLine,
      pendingSelection.endChar,
    );
    const updated = [...currentHighlights, newHl];
    settingsMutation.mutate({
      slideId,
      payload: { highlights: updated },
    });
    setPendingSelection(null);
    setExpandedHighlightId(newHl.id);
  }, [pendingSelection, slideId, currentHighlights, settingsMutation]);

  const handleUpdateHighlight = useCallback(
    (id: string, patch: Partial<Highlight>) => {
      if (!slideId) return;
      const updated = currentHighlights.map((hl) =>
        hl.id === id ? { ...hl, ...patch } : hl,
      );
      settingsMutation.mutate(
        {
          slideId,
          payload: { highlights: updated },
        },
        {
          onSuccess: () => {
            // Sync preview back to DB state after successful save
            clearPreviewHighlightSetting(id);
          },
        },
      );
    },
    [slideId, currentHighlights, settingsMutation, clearPreviewHighlightSetting],
  );

  const handleDeleteHighlight = useCallback(
    (id: string) => {
      if (!slideId) return;
      const deletedIndex = currentHighlights.findIndex((hl) => hl.id === id);
      const updated = currentHighlights.filter((hl) => hl.id !== id);
      settingsMutation.mutate(
        {
          slideId,
          payload: { highlights: updated },
        },
        {
          onSuccess: () => clearPreviewHighlightSetting(id),
        },
      );
      if (expandedHighlightId === id) {
        setExpandedHighlightId(null);
      }
      if (deletedIndex >= 0) {
        if (previewHighlightIndex === deletedIndex) {
          setPreviewHighlightIndex(-1);
        } else if (previewHighlightIndex > deletedIndex) {
          setPreviewHighlightIndex(previewHighlightIndex - 1);
        }
      }
    },
    [
      slideId,
      currentHighlights,
      settingsMutation,
      expandedHighlightId,
      previewHighlightIndex,
      setPreviewHighlightIndex,
      clearPreviewHighlightSetting,
    ],
  );

  const handleMoveHighlight = useCallback(
    (id: string, dir: -1 | 1) => {
      if (!slideId) return;
      const from = currentHighlights.findIndex((hl) => hl.id === id);
      const to = from + dir;
      if (from < 0 || to < 0 || to >= currentHighlights.length) return;
      const updated = [...currentHighlights];
      const [moved] = updated.splice(from, 1);
      updated.splice(to, 0, moved);
      settingsMutation.mutate({
        slideId,
        payload: { highlights: updated },
      });
      if (previewHighlightIndex === from) {
        setPreviewHighlightIndex(to);
      } else if (previewHighlightIndex === to) {
        setPreviewHighlightIndex(from);
      }
    },
    [
      slideId,
      currentHighlights,
      settingsMutation,
      previewHighlightIndex,
      setPreviewHighlightIndex,
    ],
  );

  const handleReorderHighlight = useCallback(
    (ids: string[], rollback: () => void) => {
      if (!slideId) return;
      const previewId = previewHighlightIndex >= 0
        ? currentHighlights[previewHighlightIndex]?.id
        : undefined;
      const byId = new Map(currentHighlights.map((hl) => [hl.id, hl]));
      const updated = ids.map((id) => byId.get(id)).filter((hl): hl is Highlight => !!hl);
      if (updated.length !== currentHighlights.length) {
        rollback();
        return;
      }
      settingsMutation.mutate(
        { slideId, payload: { highlights: updated } },
        { onError: rollback },
      );
      if (previewId) {
        setPreviewHighlightIndex(updated.findIndex((hl) => hl.id === previewId));
      }
    },
    [
      slideId,
      currentHighlights,
      previewHighlightIndex,
      settingsMutation,
      setPreviewHighlightIndex,
    ],
  );

  const handlePreviewHighlight = useCallback(
    (index: number) => {
      setPreviewHighlightIndex(
        previewHighlightIndex === index ? -1 : index,
      );
    },
    [previewHighlightIndex, setPreviewHighlightIndex],
  );

  useEffect(() => {
    if (!highlightMode) setPreviewHighlightIndex(-1);
  }, [highlightMode, setPreviewHighlightIndex]);

  useEffect(() => {
    setPreviewHighlightIndex(-1);
    setExpandedHighlightId(null);
  }, [slideId, setPreviewHighlightIndex]);

  if (!slide) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No slide selected
      </div>
    );
  }

  const gutterWidth = Math.max(2, String(lineCount).length) * 0.65 + 1.25;

  const defaultFg = isDarkBg ? "#abb2bf" : "#383a42";

  return (
    <div className="flex h-full min-w-0 flex-col bg-card">
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b px-2">
        <EditorSlideNav index={currentIndex} total={project.slides.length} onNavigate={goSlide} />

        <div className="flex min-w-0 items-center gap-1">
          <select
            className="h-7 max-w-[9rem] truncate rounded-md border border-input bg-background px-2 text-xs"
            value={language}
            onChange={(e) => {
              projectSettingsMutation.mutate({ language: e.target.value });
            }}
            title="Project language"
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>

          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "relative h-7 w-7 shrink-0",
              highlightMode && "bg-primary/15 text-primary",
            )}
            onClick={() =>
              setHighlightMode((v) => {
                if (v) setContextMenuVisible(false);
                return !v;
              })
            }
            title={
              highlightMode
                ? "Highlight mode ON — select text — toolbar or right-click to add highlights"
                : "Toggle highlight mode"
            }
          >
            <HighlighterIcon className="h-3.5 w-3.5" />
            {currentHighlights.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-3 min-w-3 items-center justify-center rounded-full bg-primary px-0.5 text-[8px] font-semibold leading-none text-primary-foreground">
                {currentHighlights.length}
              </span>
            )}
          </Button>

          {onToggleExpand && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={onToggleExpand}
              title={expanded ? "Exit expanded" : "Expand editor"}
            >
              {expanded ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
          {onCollapse && !expanded && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={onCollapse}
              title="Collapse code panel"
            >
              <PanelRightClose className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7 shrink-0", wrapLines && "bg-primary/15 text-primary")}
            onClick={() => setWrapLines((v) => !v)}
            title={wrapLines ? "Disable word wrap" : "Enable word wrap"}
          >
            <WrapText className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => (isFindOpen ? closeFind() : openFind())}
            title="Find/Replace (Cmd+F)"
          >
            <Search className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {isFindOpen && <FindReplaceBar fr={findReplace} onClose={closeFind} />}

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {editorShowLineNumbers && !wrapLines && (
          <div
            ref={gutterRef}
            aria-hidden
            className="shrink-0 overflow-hidden border-r border-border/50 bg-muted/30 py-4 text-right font-mono text-muted-foreground/70 select-none"
            style={{
              width: `${gutterWidth}rem`,
              fontSize: editorFontSize,
              lineHeight,
              paddingRight: "0.5rem",
            }}
          >
            <pre
              className="m-0 whitespace-pre text-right"
              style={{
                fontSize: editorFontSize,
                lineHeight,
                margin: 0,
                padding: 0,
                background: "transparent",
              }}
            >
              {lineNumbersText}
            </pre>
          </div>
        )}

        <div className="relative min-w-0 flex-1 overflow-hidden">
          <pre
            ref={preRef}
            aria-hidden
            className="editor-highlight pointer-events-none absolute inset-0 overflow-auto py-4 pl-3 pr-4 font-mono"
            style={{ fontSize: editorFontSize, lineHeight, whiteSpace: wrapLines ? "pre-wrap" : "pre", overflowWrap: wrapLines ? "break-word" : "normal" }}
          >
            {highlightedHtml ? (
              <code
                dangerouslySetInnerHTML={{
                  __html: highlightedHtml + "\n",
                }}
              />
            ) : (
              <code style={{ color: defaultFg }}>{code + "\n"}</code>
            )}
          </pre>
          <textarea
            ref={textareaRef}
            data-openslides-editor
            defaultValue={code}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onSelect={handleSelect}
            onMouseMove={(e) => {
              pointerRef.current = { x: e.clientX, y: e.clientY };
            }}
            onMouseUp={handleMouseUp}
            onBlur={saveCaret}
            onScroll={syncScroll}
            onContextMenu={handleContextMenu}
            spellCheck={false}
            autoCorrect="off"
            autoComplete="off"
            autoCapitalize="off"
            autoSave="off"
            data-gramm="false"
            data-gramm_editor="false"
            data-enable-grammarly="false"
            data-ms-editor="false"
            data-lt-active="false"
            data-spellcheck="false"
            lang="en"
            inputMode="text"
            enterKeyHint="enter"
            className="absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent py-4 pl-3 pr-4 font-mono text-transparent caret-white outline-none"
            wrap={wrapLines ? "soft" : "off"}
            style={
              {
                fontSize: editorFontSize,
                lineHeight,
                tabSize: 2,
                whiteSpace: wrapLines ? "pre-wrap" : "pre",
                overflowWrap: wrapLines ? "break-word" : "normal",
                WebkitTextSizeAdjust: "100%",
              } as React.CSSProperties
            }
          />
        </div>
      </div>

      <HighlightContextMenu
        visible={contextMenuVisible}
        position={contextMenuPosition}
        onAddHighlight={handleAddHighlight}
        onClose={() => setContextMenuVisible(false)}
      />

      <SlideTimingSliders project={project} slide={slide} />

      {highlightMode && currentHighlights.length === 0 && (
        <div className="shrink-0 border-t border-border/50 bg-muted/20 px-3 py-2">
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Highlight mode is on — select code and a toolbar appears (or right-click) to choose{" "}
            <span className="font-medium text-foreground/80">Add Highlight</span>.
            Steps play in order with <kbd className="rounded border border-border bg-background px-1 font-mono text-[9px]">→</kbd>{" "}
            or a click before the next slide.
          </p>
        </div>
      )}

      {(highlightMode || currentHighlights.length > 0) && (
        <HighlightSettingsPanel
          highlights={currentHighlights}
          code={code}
          expandedId={expandedHighlightId}
          previewIndex={previewHighlightIndex}
          onToggleExpand={(id) =>
            setExpandedHighlightId((prev) => (prev === id ? null : id))
          }
          onUpdate={handleUpdateHighlight}
          onDelete={handleDeleteHighlight}
          onPreview={handlePreviewHighlight}
          onMove={handleMoveHighlight}
          onReorder={handleReorderHighlight}
        />
      )}
    </div>
  );
}