/**
 * Syntax-highlighted code editor with:
 * - debounced auto-save (flushed on slide change / unmount)
 * - Tab inserts spaces (no focus steal)
 * - project-wide language in settings
 * - editor line numbers (settings only)
 * - per-slide animation knobs disabled when global overrides are on
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
} from "lucide-react";
import { getHighlighter } from "@/lib/shiki-instance";
import { highlightMerustmarCode } from "@/lib/merustmar-highlight";
import {
  LIGHT_THEMES,
  SUPPORTED_LANGUAGES,
  type Project,
} from "@/types";
import { useUiStore } from "@/store/useUiStore";
import {
  useUpdateSettings,
  useUpdateSlideCode,
  useUpdateSlideSettings,
} from "@/hooks/useProjectQueries";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";
import { cn } from "@/lib/utils";

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
  const {
    currentSlideId,
    setCurrentSlideId,
    localCode,
    setLocalCode,
    setSaveStatus,
    editorShowLineNumbers,
  } = useUiStore();

  const slide =
    project.slides.find((s) => s.id === currentSlideId) ?? project.slides[0];
  const slideId = slide?.id;

  const code = (slideId && localCode[slideId]) ?? slide?.code ?? "";
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const codeMutation = useUpdateSlideCode();
  const settingsMutation = useUpdateSlideSettings(project.id);
  const projectSettingsMutation = useUpdateSettings(project.id);

  const useGlobalTransition = project.settings.useGlobalTransition;
  const useGlobalStagger = project.settings.useGlobalStagger;
  const language =
    project.settings.language ||
    project.slides[0]?.language ||
    "typescript";

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
          onSuccess: () => setSaveStatus("saved"),
          onError: () => setSaveStatus("error"),
        },
      );
    },
    500,
  );

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

  const handleChange = useCallback(
    (value: string) => {
      if (!slideId) return;
      setLocalCode(slideId, value);
      debouncedSave(slideId, value);
    },
    [slideId, setLocalCode, debouncedSave],
  );

  /** Insert spaces on Tab; unindent on Shift+Tab. */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== "Tab" || !slideId) return;
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const value = el.value;

      if (e.shiftKey) {
        // Unindent current line(s)
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

  const highlighted = useMemo(() => {
    if (!slide) return "";
    if (highlighter) {
      const loaded = highlighter.getLoadedLanguages().includes(language);
      if (loaded) {
        try {
          const html = highlighter.codeToHtml(code, { lang: language, theme });
          const match = html.match(/<code[^>]*>([\s\S]*?)<\/code>/);
          if (match) return match[1];
        } catch {
          /* fall through */
        }
      }
    }
    if (language === "merustmar") {
      return highlightMerustmarCode(code, isDarkBg);
    }
    return code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }, [code, highlighter, language, theme, isDarkBg, slide]);

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
          <span className="min-w-0 truncate text-center text-xs text-muted-foreground">
            {currentIndex + 1} / {project.slides.length}
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
            value={code}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onScroll={syncScroll}
            spellCheck={false}
            className="absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent py-4 pl-3 pr-4 font-mono text-transparent caret-white outline-none"
            style={{ fontSize: editorFontSize, lineHeight, tabSize: 2 }}
            wrap="off"
          />
        </div>
      </div>

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
    </div>
  );
}
