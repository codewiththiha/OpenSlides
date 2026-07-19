/**
 * Syntax-highlighted code editor — refactored to single Web Worker pipeline.
 *
 * FIXES:
 * - NSSpellServer timeout: aggressive spellcheck/autocorrect disabling
 * - Triple pipeline removed: previously shikiSync (blocking 2-5ms) + runHighlight (debounced) + plainEscaped (4 regex O(n) per keystroke)
 *   Now: single worker pipeline + cheap merustmar sync fallback (no regex), no plain flash.
 * - Laggy DebouncedSlider: now uses instant preview Zustand overrides for live SlidePreview.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  PanelRightClose,
  Highlighter as HighlighterIcon,
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
import {
  useUpdateSettings,
  useUpdateSlideCode,
  useUpdateSlideSettings,
} from "@/hooks/queries";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { DebouncedSlider } from "./ui/debounced-slider";
import { cn } from "@/lib/utils";
import { selectionToRange } from "@/lib/highlight-tokens";
import { markSavePending, clearPendingSave } from "@/lib/code-save";
import { HighlightContextMenu } from "./HighlightContextMenu";
import { HighlightSettingsPanel } from "./HighlightSettingsPanel";
import { createDefaultHighlight } from "@/lib/highlight-utils";
import { useShikiWorker } from "@/hooks/useShikiWorker";

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
  const setCaretPosition = useUiStore((s) => s.setCaretPosition);

  // preview overrides
  const previewProject = useUiStore((s) => s.previewProject);
  const previewSlides = useUiStore((s) => s.previewSlides);
  const setPreviewProjectSetting = useUiStore((s) => s.setPreviewProjectSetting);
  const setPreviewSlideSetting = useUiStore((s) => s.setPreviewSlideSetting);
  const clearPreviewProjectSetting = useUiStore((s) => s.clearPreviewProjectSetting);
  const clearPreviewSlideSetting = useUiStore((s) => s.clearPreviewSlideSetting);
  const clearPreviewHighlightSetting = useUiStore((s) => s.clearPreviewHighlightSetting);

  const slide =
    project.slides.find((s) => s.id === currentSlideId) ?? project.slides[0];
  const slideId = slide?.id;

  const localCodeAtom = useLocalCodeAtom(slideId);
  const code = localCodeAtom ?? slide?.code ?? "";
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

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
    const saved = useUiStore.getState().caretPositions[slideId];
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideId]);

  const saveCaret = useCallback(() => {
    const el = textareaRef.current;
    if (!el || !slideId) return;
    try {
      setCaretPosition(slideId, el.selectionStart, el.selectionEnd);
    } catch {}
  }, [slideId, setCaretPosition]);

  // Highlight mode state
  const [highlightMode, setHighlightMode] = useState(false);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [pendingSelection, setPendingSelection] = useState<{
    startLine: number;
    startChar: number;
    endLine: number;
    endChar: number;
  } | null>(null);
  const [expandedHighlightId, setExpandedHighlightId] = useState<string | null>(null);

  const codeMutation = useUpdateSlideCode();
  const settingsMutation = useUpdateSlideSettings(project.id);
  const projectSettingsMutation = useUpdateSettings(project.id);

  const useGlobalTransition = project.settings.useGlobalTransition;
  const useGlobalStagger = project.settings.useGlobalStagger;
  const language = resolveProjectLanguage(project);
  const theme = project.theme;
  const isDarkBg = !LIGHT_THEMES.has(theme);

  // Effective editor font size with preview override — live during drag
  const rawEditorFontSize = project.settings.editorFontSize || 14;
  const editorFontSize = previewProject.editorFontSize ?? rawEditorFontSize;
  const lineHeight = 1.55;

  const lineCount = useMemo(() => Math.max(1, code.split("\n").length), [code]);

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
    (value: string) => {
      if (!slideId) return;
      setLocalCode(slideId, value);
      markSavePending(slideId, value);
      debouncedSave(slideId, value);
    },
    [slideId, setLocalCode, debouncedSave],
  );

  const handleChange = applyCode;

  // Undo/redo bridge for native menu
  useEffect(() => {
    const exec = (cmd: "undo" | "redo") => {
      const el = textareaRef.current;
      if (!el || document.activeElement !== el) return;
      if (typeof document.execCommand === "function") {
        document.execCommand(cmd);
      }
    };
    const onUndo = () => exec("undo");
    const onRedo = () => exec("redo");
    window.addEventListener("openslides:undo", onUndo);
    window.addEventListener("openslides:redo", onRedo);
    return () => {
      window.removeEventListener("openslides:undo", onUndo);
      window.removeEventListener("openslides:redo", onRedo);
    };
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== "Tab" || !slideId) return;
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const value = el.value;

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
        handleChange(next);
        return;
      }

      const next = value.slice(0, start) + TAB_SPACES + value.slice(end);
      // Synchronous update guarantees caret positioning happens in exact same microtask as value update
      el.value = next;
      const pos = start + TAB_SPACES.length;
      try {
        el.selectionStart = el.selectionEnd = pos;
      } catch {}
      handleChange(next);
    },
    [slideId, handleChange],
  );

  const syncScroll = () => {
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

  const currentIndex = project.slides.findIndex((s) => s.id === slideId);

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

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!highlightMode) return;
      e.preventDefault();

      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      if (start === end) return;

      setPendingSelection(selectionToRange(code, start, end));
      setContextMenuPosition({ x: e.clientX, y: e.clientY });
      setContextMenuVisible(true);
    },
    [highlightMode, code],
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

  // Effective per-slide values with preview overrides for instant feedback
  const previewForThisSlide = slideId ? previewSlides[slideId] : undefined;
  const effTransition = useGlobalTransition
    ? (previewProject.globalTransitionDuration ??
      project.settings.globalTransitionDuration)
    : (previewForThisSlide?.transitionDuration ?? slide.transitionDuration);
  const effStagger = useGlobalStagger
    ? (previewProject.globalStagger ?? project.settings.globalStagger)
    : (previewForThisSlide?.stagger ?? slide.stagger);
  const effDuration = previewForThisSlide?.duration ?? slide.duration;

  const transitionLabel = useGlobalTransition
    ? `Transition (${effTransition}ms · global)`
    : `Transition (${effTransition}ms)`;
  const staggerLabel = useGlobalStagger
    ? `Stagger (${effStagger} · global)`
    : `Stagger (${effStagger})`;
  const durationLabel = `Duration (${effDuration}ms)`;

  const defaultFg = isDarkBg ? "#abb2bf" : "#383a42";

  return (
    <div className="flex h-full min-w-0 flex-col bg-card">
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b px-2">
        <div className="flex min-w-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            disabled={currentIndex <= 0}
            onClick={() => goSlide(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="shrink-0 text-center text-[10px] text-muted-foreground/80">
            {currentIndex + 1}/{project.slides.length}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            disabled={currentIndex >= project.slides.length - 1}
            onClick={() => goSlide(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

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
            onClick={() => setHighlightMode((v) => !v)}
            title={
              highlightMode
                ? "Highlight mode ON — select text and right-click to add highlights"
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
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {editorShowLineNumbers && (
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
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i + 1}>{i + 1}</div>
            ))}
          </div>
        )}

        <div className="relative min-w-0 flex-1 overflow-hidden">
          <pre
            ref={preRef}
            aria-hidden
            className="editor-highlight pointer-events-none absolute inset-0 overflow-auto py-4 pl-3 pr-4 font-mono"
            style={{ fontSize: editorFontSize, lineHeight }}
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
            onKeyUp={saveCaret}
            onSelect={saveCaret}
            onMouseUp={saveCaret}
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
            style={
              {
                fontSize: editorFontSize,
                lineHeight,
                tabSize: 2,
                WebkitTextSizeAdjust: "100%",
              } as React.CSSProperties
            }
            wrap="off"
          />
        </div>
      </div>

      <HighlightContextMenu
        visible={contextMenuVisible}
        position={contextMenuPosition}
        onAddHighlight={handleAddHighlight}
        onClose={() => setContextMenuVisible(false)}
      />

      <div className="grid shrink-0 grid-cols-3 gap-2 border-t px-2 py-2">
        <div className={cn("min-w-0 space-y-1", useGlobalTransition && "opacity-45")}>
          <Label
            className="block truncate text-[10px] uppercase tracking-wide text-muted-foreground"
            title={transitionLabel}
          >
            {transitionLabel}
          </Label>
          <DebouncedSlider
            min={100}
            max={2000}
            step={50}
            disabled={useGlobalTransition}
            value={[
              useGlobalTransition
                ? (previewProject.globalTransitionDuration ??
                  project.settings.globalTransitionDuration)
                : (previewSlides[slide.id]?.transitionDuration ??
                  slide.transitionDuration),
            ]}
            onValueChange={([v]) => {
              if (useGlobalTransition) {
                setPreviewProjectSetting("globalTransitionDuration", v);
              } else {
                setPreviewSlideSetting(slide.id, "transitionDuration", v);
              }
            }}
            onValueCommit={([v]) => {
              if (useGlobalTransition) {
                projectSettingsMutation.mutate(
                  { globalTransitionDuration: v },
                  {
                    onSuccess: () => clearPreviewProjectSetting("globalTransitionDuration"),
                  },
                );
                return;
              }
              settingsMutation.mutate(
                {
                  slideId: slide.id,
                  payload: { transitionDuration: v },
                },
                {
                  onSuccess: () =>
                    clearPreviewSlideSetting(slide.id, "transitionDuration"),
                },
              );
            }}
          />
        </div>
        <div className={cn("min-w-0 space-y-1", useGlobalStagger && "opacity-45")}>
          <Label
            className="block truncate text-[10px] uppercase tracking-wide text-muted-foreground"
            title={staggerLabel}
          >
            {staggerLabel}
          </Label>
          <DebouncedSlider
            min={0}
            max={50}
            step={1}
            disabled={useGlobalStagger}
            value={[
              useGlobalStagger
                ? (previewProject.globalStagger ?? project.settings.globalStagger)
                : (previewSlides[slide.id]?.stagger ?? slide.stagger),
            ]}
            onValueChange={([v]) => {
              if (useGlobalStagger) {
                setPreviewProjectSetting("globalStagger", v);
              } else {
                setPreviewSlideSetting(slide.id, "stagger", v);
              }
            }}
            onValueCommit={([v]) => {
              if (useGlobalStagger) {
                projectSettingsMutation.mutate(
                  { globalStagger: v },
                  {
                    onSuccess: () => clearPreviewProjectSetting("globalStagger"),
                  },
                );
                return;
              }
              settingsMutation.mutate(
                {
                  slideId: slide.id,
                  payload: { stagger: v },
                },
                {
                  onSuccess: () => clearPreviewSlideSetting(slide.id, "stagger"),
                },
              );
            }}
          />
        </div>
        <div className="min-w-0 space-y-1">
          <Label
            className="block truncate text-[10px] uppercase tracking-wide text-muted-foreground"
            title={durationLabel}
          >
            {durationLabel}
          </Label>
          <DebouncedSlider
            min={500}
            max={10000}
            step={100}
            value={[previewSlides[slide.id]?.duration ?? slide.duration]}
            onValueChange={([v]) => setPreviewSlideSetting(slide.id, "duration", v)}
            onValueCommit={([v]) =>
              settingsMutation.mutate(
                {
                  slideId: slide.id,
                  payload: { duration: v },
                },
                {
                  onSuccess: () => clearPreviewSlideSetting(slide.id, "duration"),
                },
              )
            }
          />
        </div>
      </div>

      {highlightMode && currentHighlights.length === 0 && (
        <div className="shrink-0 border-t border-border/50 bg-muted/20 px-3 py-2">
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Highlight mode is on — select code, then right-click and choose{" "}
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
        />
      )}
    </div>
  );
}
