/**
 * Syntax-highlighted code editor with:
 * - debounced auto-save (flushed on slide change / unmount)
 * - Tab inserts spaces (no focus steal)
 * - project-wide language in settings
 * - editor line numbers (settings only)
 * - per-slide animation knobs disabled when global overrides are on
 * - highlight mode toggle and management
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Highlighter } from "shiki";
import { useDebouncedCallback } from "use-debounce";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  PanelRightClose,
  Highlighter as HighlighterIcon,
} from "lucide-react";
import { getHighlighter } from "@/lib/shiki-instance";
import { highlightMerustmarCode } from "@/lib/merustmar-highlight";
import {
  LIGHT_THEMES,
  SUPPORTED_LANGUAGES,
  resolveProjectLanguage,
  type Project,
  type Highlight,
} from "@/types";
import { useUiStore } from "@/store/useUiStore";
import {
  useUpdateSettings,
  useUpdateSlideCode,
  useUpdateSlideSettings,
} from "@/hooks/queries";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";
import { cn, escapeHtml } from "@/lib/utils";
import { api } from "@/lib/tauri-api";
import { renderTokenLines, selectionToRange } from "@/lib/highlight-tokens";
import { markSavePending, clearPendingSave } from "@/lib/save-flush";
import { HighlightContextMenu } from "./HighlightContextMenu";
import { HighlightSettingsPanel } from "./HighlightSettingsPanel";
import { createDefaultHighlight } from "@/lib/highlight-utils";

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
  // Fine-grained selectors: subscribing to the whole store would re-render
  // this editor (and everything below it) on every unrelated store update.
  const currentSlideId = useUiStore((s) => s.currentSlideId);
  const setCurrentSlideId = useUiStore((s) => s.setCurrentSlideId);
  const localCode = useUiStore((s) => s.localCode);
  const setLocalCode = useUiStore((s) => s.setLocalCode);
  const setSaveStatus = useUiStore((s) => s.setSaveStatus);
  const editorShowLineNumbers = useUiStore((s) => s.editorShowLineNumbers);
  const previewHighlightIndex = useUiStore((s) => s.previewHighlightIndex);
  const setPreviewHighlightIndex = useUiStore(
    (s) => s.setPreviewHighlightIndex,
  );

  const slide =
    project.slides.find((s) => s.id === currentSlideId) ?? project.slides[0];
  const slideId = slide?.id;

  const code = (slideId && localCode[slideId]) ?? slide?.code ?? "";
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  // ── Uncontrolled textarea, by design ────────────────────────────────
  // The textarea is intentionally NOT value-controlled. User report
  // (WKWebView/macOS): mid-line edit → re-render → caret teleports to the
  // end of the code. Any commit in which React (re)assigns `.value` can
  // slam the caret per the value-setter spec, and the transparent-textarea-
  // over-highlight overlay makes every keystroke produce several re-renders
  // (store echo, overlay re-highlight, save-status chip, cache stamps).
  // Rather than prove every write benign, we make writes structurally
  // impossible while typing: the DOM node is the source of truth during
  // editing, and we only push text INTO it on external transitions —
  // mount, slide switch, undo/redo. The UI-facing `code` (preview, overlay,
  // line numbers, highlight slicing) still derives from the store.
  //
  // External code writers to an OPEN slide do not exist (settings responses
  // preserve `code`; imports/restores touch other slides), so no sync-on-
  // project-change is needed — only slide identity transitions.
  //
  // Mount + slide switch are the only legal hard-sync moments during a
  // session; the dep list is deliberately slideId-ONLY so store echoes from
  // typing never rewrite the DOM value (and the caret with it).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el || !slideId) return;
    const next =
      useUiStore.getState().localCode[slideId] ?? slide?.code ?? "";
    if (el.value !== next) {
      el.value = next;
      el.selectionStart = el.selectionEnd = next.length;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- slide?.code is
    // intentionally read from the slideId-change render only; re-running on
    // every code edit would defeat the whole uncontrolled design above.
  }, [slideId]);

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

  useEffect(() => {
    let cancelled = false;
    getHighlighter().then((h) => {
      if (!cancelled) setHighlighter(h);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  // (No undo-stack seeding: the textarea is uncontrolled, so the browser
  // owns undo/redo natively — see the menu-delegation effect below.)

  // Flush pending auto-save when leaving a slide or unmounting the editor
  useEffect(() => {
    return () => {
      debouncedSave.flush();
    };
  }, [slideId, debouncedSave]);

  useEffect(() => {
    return () => {
      debouncedSave.flush();
    };
  }, [debouncedSave]);

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

  // Undo/redo is OWNED BY THE BROWSER: the textarea is uncontrolled
  // (defaultValue; see the design comment near the top of this component),
  // so the native undo stack works — including word-level granularity and
  // IME composition groups the old custom snapshot stack ("Native textarea
  // undo breaks under React controlled values" — stale rationale) never
  // had. Keyboard shortcuts need NO handlers: Cmd+Z / Shift+Cmd+Z (macOS)
  // and Ctrl+Z / Ctrl+Y (Windows) are native in focused textareas. A slide
  // switch writes `.value` imperatively, which resets the native undo
  // history — this is a feature: undo can never bleed across slides.
  //
  // The only bridge still required is the native app MENU: it emits custom
  // "menu://undo" events (Editor.tsx → window "openslides:undo"), not
  // PredefinedMenuItem, so we delegate to the SAME native machinery via
  // execCommand. Per platform convention, Undo acts on the focused
  // (first-responder) editable region — two editors can be mounted
  // (expanded overlay + rail panel), so we only act when THIS textarea has
  // focus. execCommand() fires the textarea's `input` event, so onChange →
  // store → auto-save stay in sync. Guarded for jsdom (no execCommand).
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

  /** Insert spaces on Tab; unindent on Shift+Tab. */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Undo/redo (Cmd/Ctrl+Z etc.) must NOT be intercepted here — native
      // textarea undo owns those keys (see the menu-delegation comment).
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
        handleChange(next);
        requestAnimationFrame(() => {
          const pos = Math.max(lineStart, start - removed);
          el.selectionStart = el.selectionEnd = pos;
        });
        return;
      }

      const next = value.slice(0, start) + TAB_SPACES + value.slice(end);
      handleChange(next);
      requestAnimationFrame(() => {
        const pos = start + TAB_SPACES.length;
        el.selectionStart = el.selectionEnd = pos;
      });
    },
    [slideId, handleChange],
  );

  const theme = project.theme;
  const isDarkBg = !LIGHT_THEMES.has(theme);
  const editorFontSize = project.settings.editorFontSize || 14;
  const lineHeight = 1.55;

  const lineCount = useMemo(() => Math.max(1, code.split("\n").length), [code]);

  // Escape-only fallback (cheap) shown while Shiki runs
  const plainEscaped = useMemo(() => escapeHtml(code), [code]);

  const [highlighted, setHighlighted] = useState(plainEscaped);
  // Monotonic token so a late async result can never overwrite a newer one.
  const hlReqRef = useRef(0);

  // Debounce highlight so rapid keystrokes don't block the main thread.
  // Merustmar renders in Rust (off-thread); everything else stays on Shiki.
  const runHighlight = useDebouncedCallback(
    (
      src: string,
      lang: string,
      th: string,
      dark: boolean,
      h: Highlighter | null,
    ) => {
      const req = ++hlReqRef.current;
      if (h) {
        const loaded = h.getLoadedLanguages().includes(lang);
        if (loaded) {
          try {
            const html = h.codeToHtml(src, { lang, theme: th });
            const match = html.match(/<code[^>]*>([\s\S]*?)<\/code>/);
            if (match) {
              setHighlighted(match[1]);
              return;
            }
          } catch {
            /* fall through */
          }
        }
      }
      if (lang === "merustmar") {
        api
          .merustmarTokens(src, dark)
          .then((tokens) => {
            if (hlReqRef.current === req) setHighlighted(renderTokenLines(tokens));
          })
          .catch(() => {
            // Frozen JS fallback (kept per repo policy) if IPC fails.
            if (hlReqRef.current === req) {
              setHighlighted(highlightMerustmarCode(src, dark));
            }
          });
        return;
      }
      setHighlighted(escapeHtml(src));
    },
    120,
  );

  useEffect(() => {
    // Immediate cheap fallback so caret/overlay stay aligned while waiting;
    // also invalidates any in-flight async highlight from the older code.
    hlReqRef.current++;
    setHighlighted(plainEscaped);
    if (!slide) return;
    runHighlight(code, language, theme, isDarkBg, highlighter);
  }, [
    code,
    language,
    theme,
    isDarkBg,
    highlighter,
    slide,
    plainEscaped,
    runHighlight,
  ]);

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
    // Flush pending save before switching
    debouncedSave.flush();
    const next = project.slides[currentIndex + dir];
    if (next) setCurrentSlideId(next.id);
  };

  // Highlight CRUD operations
  const currentHighlights = slide?.highlights ?? [];

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!highlightMode) return; // Let default context menu appear
      e.preventDefault();

      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      if (start === end) return; // No selection

      // Flat offsets → line/char range — single implementation, shared with
      // the overlay pipeline (src/lib/highlight-tokens.ts).
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
      settingsMutation.mutate({
        slideId,
        payload: { highlights: updated },
      });
    },
    [slideId, currentHighlights, settingsMutation],
  );

  const handleDeleteHighlight = useCallback(
    (id: string) => {
      if (!slideId) return;
      const deletedIndex = currentHighlights.findIndex((hl) => hl.id === id);
      const updated = currentHighlights.filter((hl) => hl.id !== id);
      settingsMutation.mutate({
        slideId,
        payload: { highlights: updated },
      });
      if (expandedHighlightId === id) {
        setExpandedHighlightId(null);
      }
      // Fix preview index after removal (indices are positional)
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
      // Keep the preview pinned to the moved step if it was being previewed
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

  // Clear preview when leaving highlight mode or switching slides
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

  const transitionLabel = useGlobalTransition
    ? `Transition (${project.settings.globalTransitionDuration}ms · global)`
    : `Transition (${slide.transitionDuration}ms)`;
  const staggerLabel = useGlobalStagger
    ? `Stagger (${project.settings.globalStagger} · global)`
    : `Stagger (${slide.stagger})`;
  const durationLabel = `Duration (${slide.duration}ms)`;

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
            <code dangerouslySetInnerHTML={{ __html: highlighted + "\n" }} />
          </pre>
          <textarea
            ref={textareaRef}
            data-openslides-editor
            // Uncontrolled (see the design comment near the top of this
            // component): NO `value` prop. `defaultValue` seeds first mount;
            // later writes happen only via the slideId effect / undo / redo.
            defaultValue={code}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onScroll={syncScroll}
            onContextMenu={handleContextMenu}
            spellCheck={false}
            className="absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent py-4 pl-3 pr-4 font-mono text-transparent caret-white outline-none"
            style={{ fontSize: editorFontSize, lineHeight, tabSize: 2 }}
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
          <Slider
            min={100}
            max={2000}
            step={50}
            disabled={useGlobalTransition}
            value={[
              useGlobalTransition
                ? project.settings.globalTransitionDuration
                : slide.transitionDuration,
            ]}
            onValueChange={([v]) => {
              if (useGlobalTransition) return;
              settingsMutation.mutate({
                slideId: slide.id,
                payload: { transitionDuration: v },
              });
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
          <Slider
            min={0}
            max={50}
            step={1}
            disabled={useGlobalStagger}
            value={[useGlobalStagger ? project.settings.globalStagger : slide.stagger]}
            onValueChange={([v]) => {
              if (useGlobalStagger) return;
              settingsMutation.mutate({
                slideId: slide.id,
                payload: { stagger: v },
              });
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
          <Slider
            min={500}
            max={10000}
            step={100}
            value={[slide.duration]}
            onValueChange={([v]) =>
              settingsMutation.mutate({
                slideId: slide.id,
                payload: { duration: v },
              })
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

      {/* Management panel stays available whenever the slide has highlights,
          not only while highlight mode is on — otherwise saved highlights
          become un-editable/un-deletable after a reload. */}
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
