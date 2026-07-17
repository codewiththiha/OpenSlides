/**
 * Main editor workspace —
 * single toolbar, resizable preview/editor + slides strip,
 * auto-collapse when panels are dragged too narrow,
 * collapsed panels show an edge chip (like slides),
 * expand restores last persisted size from Zustand.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type ImperativePanelHandle,
} from "react-resizable-panels";
import {
  Home,
  MonitorPlay,
  Settings2,
  Download,
  Focus,
  Loader2,
  Check,
  AlertCircle,
  Moon,
  Sun,
  Command as CommandIcon,
  ChevronLeft,
  Code2,
} from "lucide-react";
import { Button } from "./ui/button";
import { TitleBar } from "./TitleBar";
import { SlidePreview } from "./SlidePreview";
import { CodeEditor } from "./CodeEditor";
import { BottomSlidesPanel } from "./BottomSlidesPanel";
import { SettingsDrawer } from "./SettingsDrawer";
import { CommandPalette } from "./CommandPalette";
import { useUiStore } from "@/store/useUiStore";
import {
  useProject,
  useExportProject,
  useCreateSlide,
  useUpdateTheme,
  useCreateProject,
} from "@/hooks/useProjectQueries";
import { api } from "@/lib/tauri-api";
import { cn } from "@/lib/utils";
import { modKeyLabel } from "@/lib/platform";
import { useAppMenu } from "@/hooks/useAppMenu";
import { getCurrentWindow } from "@tauri-apps/api/window";

/** Below this % of the horizontal group, code panel auto-collapses. */
const CODE_COLLAPSE_THRESHOLD = 14;
/** Below this % of the vertical group, slides panel auto-collapses. */
const SLIDES_COLLAPSE_THRESHOLD = 10;

/**
 * Collapsed rail size (% of group).
 * Slides needs a larger % so the chip stays readable on short windows;
 * content also uses min-height as a floor.
 */
const CODE_COLLAPSED_SIZE = 3.5;
const SLIDES_COLLAPSED_SIZE = 6;

export function Editor() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading, isError, error } = useProject(projectId);

  const {
    currentSlideId,
    setCurrentSlideId,
    isPresenting,
    setIsPresenting,
    isZenMode,
    toggleZenMode,
    isSettingsOpen,
    setIsSettingsOpen,
    isCommandOpen,
    setIsCommandOpen,
    isDarkUi,
    setIsDarkUi,
    saveStatus,
    resetEditorUi,
    isBottomPanelCollapsed,
    setIsBottomPanelCollapsed,
    isCodePanelCollapsed,
    setIsCodePanelCollapsed,
    codePanelSize,
    setCodePanelSize,
    slidesPanelSize,
    setSlidesPanelSize,
  } = useUiStore();

  const exportMutation = useExportProject();
  const createSlide = useCreateSlide(projectId ?? "");
  const updateTheme = useUpdateTheme(projectId ?? "");
  const createProject = useCreateProject();
  const [editorExpanded, setEditorExpanded] = useState(false);

  const codePanelRef = useRef<ImperativePanelHandle>(null);
  const slidesPanelRef = useRef<ImperativePanelHandle>(null);
  const codeCollapseLock = useRef(false);
  const slidesCollapseLock = useRef(false);

  useEffect(() => {
    const title = project ? `OpenSlides — ${project.name}` : "OpenSlides";
    document.title = title;
    getCurrentWindow()
      .setTitle(title)
      .catch(() => undefined);
  }, [project]);

  useEffect(() => {
    if (!project) return;
    if (!currentSlideId || !project.slides.some((s) => s.id === currentSlideId)) {
      const id = project.settings.currentSlideId ?? project.slides[0]?.id ?? null;
      setCurrentSlideId(id);
    }
  }, [project, currentSlideId, setCurrentSlideId]);

  useEffect(() => {
    if (!projectId || !currentSlideId) return;
    const t = window.setTimeout(() => {
      api.setCurrentSlide(projectId, currentSlideId).catch(() => undefined);
    }, 300);
    return () => window.clearTimeout(t);
  }, [projectId, currentSlideId]);

  useEffect(() => {
    return () => resetEditorUi();
  }, [resetEditorUi]);

  // Keep imperative panel collapse state in sync with store
  useEffect(() => {
    const panel = codePanelRef.current;
    if (!panel) return;
    try {
      if (isCodePanelCollapsed) {
        if (!panel.isCollapsed()) panel.collapse();
      } else if (panel.isCollapsed()) {
        panel.expand(codePanelSize);
      }
    } catch {
      /* ignore */
    }
  }, [isCodePanelCollapsed, codePanelSize]);

  useEffect(() => {
    const panel = slidesPanelRef.current;
    if (!panel) return;
    try {
      if (isBottomPanelCollapsed) {
        if (!panel.isCollapsed()) panel.collapse();
      } else if (panel.isCollapsed()) {
        panel.expand(slidesPanelSize);
      }
    } catch {
      /* ignore */
    }
  }, [isBottomPanelCollapsed, slidesPanelSize]);

  const slides = project?.slides ?? [];
  const currentIndex = slides.findIndex((s) => s.id === currentSlideId);

  const toggleTheme = useCallback(() => {
    const next = !isDarkUi;
    setIsDarkUi(next);
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.classList.toggle("light", !next);
  }, [isDarkUi, setIsDarkUi]);

  const goNextSlide = useCallback(() => {
    if (currentIndex < slides.length - 1) {
      setCurrentSlideId(slides[currentIndex + 1].id);
    }
  }, [currentIndex, slides, setCurrentSlideId]);

  const goPrevSlide = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentSlideId(slides[currentIndex - 1].id);
    }
  }, [currentIndex, slides, setCurrentSlideId]);

  /** True when focus is in a text field where arrows should move the caret, not slides. */
  const isTypingTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (target.isContentEditable) return true;
    return Boolean(target.closest("[contenteditable='true'], [role='textbox'], .cm-editor, .cm-content"));
  };

  const exitPresent = useCallback(async () => {
    setIsPresenting(false);
    // Exit browser fullscreen if we entered it
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      /* ignore */
    }
    // Exit native window fullscreen if we set it
    try {
      const win = getCurrentWindow();
      if (await win.isFullscreen()) {
        await win.setFullscreen(false);
      }
    } catch {
      /* ignore */
    }
  }, [setIsPresenting]);

  const tryEnterFullscreen = useCallback(async () => {
    // Prefer video-style element fullscreen, then native window fullscreen.
    const el = document.getElementById("openslides-present-root");
    try {
      if (el && el.requestFullscreen && !document.fullscreenElement) {
        await el.requestFullscreen();
        return;
      }
    } catch {
      /* fall through to Tauri */
    }
    try {
      const win = getCurrentWindow();
      if (!(await win.isFullscreen())) {
        await win.setFullscreen(true);
      }
    } catch {
      /* overlay still works windowed */
    }
  }, []);

  const enterPresent = useCallback(() => {
    setIsPresenting(true);
  }, [setIsPresenting]);

  // When present overlay mounts, request true fullscreen (browser or Tauri).
  useEffect(() => {
    if (!isPresenting) return;
    const t = window.setTimeout(() => {
      void tryEnterFullscreen();
    }, 50);
    return () => window.clearTimeout(t);
  }, [isPresenting, tryEnterFullscreen]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Present mode: arrows / space / esc
      if (isPresenting) {
        if (e.key === "Escape") {
          e.preventDefault();
          void exitPresent();
        } else if (e.key === "ArrowRight" || e.key === " ") {
          e.preventDefault();
          goNextSlide();
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          goPrevSlide();
        }
        return;
      }

      if (e.key === "Escape" && isZenMode) {
        e.preventDefault();
        toggleZenMode();
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleZenMode();
      }

      // Normal / zen: arrow keys navigate slides when not typing in an input
      if (
        (e.key === "ArrowRight" || e.key === "ArrowLeft") &&
        !isTypingTarget(e.target) &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isSettingsOpen &&
        !isCommandOpen
      ) {
        e.preventDefault();
        if (e.key === "ArrowRight") goNextSlide();
        else goPrevSlide();
      }
    },
    [
      isPresenting,
      isZenMode,
      isSettingsOpen,
      isCommandOpen,
      exitPresent,
      goNextSlide,
      goPrevSlide,
      toggleZenMode,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // If user exits OS fullscreen via Esc / system UI while presenting, leave present mode
  useEffect(() => {
    if (!isPresenting) return;
    const onFsChange = () => {
      // Only react when browser fullscreen was used and then left
      if (!document.fullscreenElement) {
        // Don't force-exit if we only used Tauri fullscreen (no document.fullscreenElement ever)
        // Heuristic: if present root existed and lost fullscreen, exit.
        const el = document.getElementById("openslides-present-root");
        if (el && !document.fullscreenElement) {
          // Check if we were the fullscreen element
          // If fullscreen just ended, sync present state off unless Tauri is still fullscreen
          void (async () => {
            try {
              const win = getCurrentWindow();
              const nativeFs = await win.isFullscreen().catch(() => false);
              if (!nativeFs) {
                setIsPresenting(false);
              }
            } catch {
              setIsPresenting(false);
            }
          })();
        }
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [isPresenting, setIsPresenting]);

  const menuHandlers = useMemo(
    () => ({
      "menu://new-project": () => {
        void createProject.mutateAsync("Untitled Deck").then((p) => {
          navigate(`/editor/${p.id}`);
        });
      },
      "menu://open-dashboard": () => navigate("/"),
      "menu://export": () => {
        if (projectId) exportMutation.mutate(projectId);
      },
      "menu://present": () => void enterPresent(),
      "menu://zen": () => toggleZenMode(),
      "menu://settings": () => setIsSettingsOpen(true),
      "menu://command-palette": () => setIsCommandOpen(true),
      "menu://add-slide": () => {
        if (projectId) createSlide.mutate({});
      },
      "menu://toggle-theme": () => toggleTheme(),
    }),
    [
      createProject,
      navigate,
      projectId,
      exportMutation,
      enterPresent,
      toggleZenMode,
      setIsSettingsOpen,
      setIsCommandOpen,
      createSlide,
      toggleTheme,
    ],
  );
  useAppMenu(menuHandlers);

  const expandCodePanel = useCallback(() => {
    setIsCodePanelCollapsed(false);
    requestAnimationFrame(() => {
      try {
        const panel = codePanelRef.current;
        if (!panel) return;
        panel.expand(codePanelSize);
        panel.resize(codePanelSize);
      } catch {
        /* ignore */
      }
    });
  }, [codePanelSize, setIsCodePanelCollapsed]);

  const collapseCodePanel = useCallback(() => {
    try {
      const size = codePanelRef.current?.getSize();
      if (typeof size === "number" && size > CODE_COLLAPSE_THRESHOLD) {
        setCodePanelSize(size);
      }
    } catch {
      /* ignore */
    }
    setIsCodePanelCollapsed(true);
    try {
      codePanelRef.current?.collapse();
    } catch {
      /* ignore */
    }
  }, [setCodePanelSize, setIsCodePanelCollapsed]);

  const expandSlidesPanel = useCallback(() => {
    setIsBottomPanelCollapsed(false);
    requestAnimationFrame(() => {
      try {
        const panel = slidesPanelRef.current;
        if (!panel) return;
        panel.expand(slidesPanelSize);
        panel.resize(slidesPanelSize);
      } catch {
        /* ignore */
      }
    });
  }, [slidesPanelSize, setIsBottomPanelCollapsed]);

  const collapseSlidesPanel = useCallback(() => {
    try {
      const size = slidesPanelRef.current?.getSize();
      if (typeof size === "number" && size > SLIDES_COLLAPSE_THRESHOLD) {
        setSlidesPanelSize(size);
      }
    } catch {
      /* ignore */
    }
    setIsBottomPanelCollapsed(true);
    try {
      slidesPanelRef.current?.collapse();
    } catch {
      /* ignore */
    }
  }, [setSlidesPanelSize, setIsBottomPanelCollapsed]);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <TitleBar title="OpenSlides" />
        <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading project…
        </div>
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="flex h-full flex-col">
        <TitleBar title="OpenSlides" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-destructive">
            {(error as Error)?.message ?? "Project not found"}
          </p>
          <Button onClick={() => navigate("/")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const saveBadge = {
    idle: null,
    saving: (
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving…
      </span>
    ),
    saved: (
      <span className="flex items-center gap-1 text-[11px] text-emerald-500">
        <Check className="h-3 w-3" /> Saved
      </span>
    ),
    error: (
      <span className="flex items-center gap-1 text-[11px] text-destructive">
        <AlertCircle className="h-3 w-3" /> Save failed
      </span>
    ),
  }[saveStatus];

  const mod = modKeyLabel();

  return (
    <div className="flex h-full flex-col bg-background">
      {!isZenMode && !isPresenting && (
        <TitleBar
          leading={
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => navigate("/")}
                title="Dashboard"
              >
                <Home className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium leading-tight">
                  {project.name}
                </div>
                <div className="truncate text-[10px] text-muted-foreground">
                  {project.slides.length} slide
                  {project.slides.length !== 1 ? "s" : ""} · {project.theme}
                </div>
              </div>
            </>
          }
          trailing={
            <>
              {saveBadge}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title={`Command palette (${mod}K)`}
                onClick={() => setIsCommandOpen(true)}
              >
                <CommandIcon className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Toggle UI theme"
                onClick={toggleTheme}
              >
                {isDarkUi ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title={`Zen mode (${mod}B)`}
                onClick={toggleZenMode}
              >
                <Focus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Export JSON"
                onClick={() => exportMutation.mutate(project.id)}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Settings"
                onClick={() => setIsSettingsOpen(true)}
              >
                <Settings2 className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                className="ml-1 gap-1.5"
                onClick={() => void enterPresent()}
              >
                <MonitorPlay className="h-3.5 w-3.5" />
                Present
              </Button>
            </>
          }
        />
      )}

      {isPresenting && (
        <div
          id="openslides-present-root"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
        >
          <button
            type="button"
            className="absolute right-4 top-4 z-[110] flex items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 text-sm text-white/70 transition hover:bg-white/20 hover:text-white"
            onClick={() => void exitPresent()}
          >
            Press{" "}
            <kbd className="rounded bg-white/20 px-2 py-0.5 font-mono text-xs">ESC</kbd>{" "}
            to exit
          </button>
          {/* Full-bleed stage (true fullscreen when API available) */}
          <div className="flex h-full w-full items-center justify-center p-0 sm:p-4">
            <div className="aspect-video h-full max-h-full w-full max-w-full">
              <SlidePreview project={project} isPresenting />
            </div>
          </div>
        </div>
      )}

      {editorExpanded && !isPresenting && (
        <div className="fixed inset-0 z-[90] bg-background/98 p-4 backdrop-blur-xl">
          <CodeEditor
            project={project}
            expanded
            onToggleExpand={() => setEditorExpanded(false)}
          />
        </div>
      )}

      {isZenMode && !isPresenting && (
        <button
          type="button"
          onClick={toggleZenMode}
          className="absolute right-3 top-3 z-30 rounded-md bg-card/80 px-2 py-1 text-[11px] text-muted-foreground shadow backdrop-blur hover:text-foreground"
        >
          Exit Zen (Esc)
        </button>
      )}

      {!isPresenting && (
        <div className={cn("flex min-h-0 flex-1 flex-col", isZenMode && "pt-0")}>
          <PanelGroup
            direction="vertical"
            className="min-h-0 flex-1"
            autoSaveId="openslides-v"
          >
            <Panel defaultSize={isZenMode ? 100 : 78} minSize={35} className="min-h-0">
              <PanelGroup
                direction="horizontal"
                className="h-full min-h-0"
                autoSaveId="openslides-h"
              >
                <Panel
                  defaultSize={
                    isCodePanelCollapsed
                      ? 100 - CODE_COLLAPSED_SIZE
                      : 100 - codePanelSize
                  }
                  minSize={30}
                  className="min-w-0"
                >
                  <div className="flex h-full items-center justify-center bg-muted/20 p-4 pb-5">
                    <div className="aspect-video h-full max-h-full w-full max-w-full">
                      <SlidePreview project={project} />
                    </div>
                  </div>
                </Panel>

                {!isZenMode && (
                  <>
                    {/* Keep handle interactive when collapsed so user can drag to expand (same as slides). */}
                    <PanelResizeHandle
                      className={cn(
                        "w-1.5 bg-border/60 transition-colors hover:bg-primary/50 data-[resize-handle-active]:bg-primary/60",
                        isCodePanelCollapsed && "w-1.5 hover:bg-primary/60",
                      )}
                    />

                    <Panel
                      ref={codePanelRef}
                      defaultSize={
                        isCodePanelCollapsed ? CODE_COLLAPSED_SIZE : codePanelSize
                      }
                      minSize={CODE_COLLAPSED_SIZE}
                      maxSize={70}
                      collapsible
                      collapsedSize={CODE_COLLAPSED_SIZE}
                      className="min-w-0"
                      onResize={(size) => {
                        if (codeCollapseLock.current) return;

                        // Drag-open from collapsed rail
                        if (isCodePanelCollapsed && size > CODE_COLLAPSE_THRESHOLD) {
                          codeCollapseLock.current = true;
                          setIsCodePanelCollapsed(false);
                          setCodePanelSize(size);
                          window.setTimeout(() => {
                            codeCollapseLock.current = false;
                          }, 150);
                          return;
                        }

                        if (!isCodePanelCollapsed && size >= CODE_COLLAPSE_THRESHOLD) {
                          setCodePanelSize(size);
                        }

                        if (!isCodePanelCollapsed && size < CODE_COLLAPSE_THRESHOLD) {
                          codeCollapseLock.current = true;
                          setIsCodePanelCollapsed(true);
                          try {
                            codePanelRef.current?.collapse();
                          } catch {
                            /* ignore */
                          }
                          window.setTimeout(() => {
                            codeCollapseLock.current = false;
                          }, 200);
                        }
                      }}
                      onCollapse={() => setIsCodePanelCollapsed(true)}
                      onExpand={() => setIsCodePanelCollapsed(false)}
                    >
                      {isCodePanelCollapsed ? (
                        <div
                          className="flex h-full w-full min-w-[28px] cursor-pointer flex-col items-center justify-center gap-2 border-l border-border/50 bg-card/60 hover:bg-muted/40"
                          onClick={expandCodePanel}
                          title="Expand code editor (or drag the handle)"
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              expandCodePanel();
                            }
                          }}
                        >
                          <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
                          <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span
                            className="select-none text-[11px] tracking-wide text-muted-foreground"
                            style={{
                              writingMode: "vertical-rl",
                              textOrientation: "mixed",
                            }}
                          >
                            Code
                          </span>
                        </div>
                      ) : (
                        <CodeEditor
                          project={project}
                          onToggleExpand={() => setEditorExpanded(true)}
                          onCollapse={collapseCodePanel}
                        />
                      )}
                    </Panel>
                  </>
                )}
              </PanelGroup>
            </Panel>

            {!isZenMode && (
              <>
                {/* Always interactive — drag up from collapsed to expand (same idea as code rail). */}
                <PanelResizeHandle
                  className={cn(
                    "h-1.5 bg-border/60 transition-colors hover:bg-primary/50 data-[resize-handle-active]:bg-primary/60",
                    isBottomPanelCollapsed && "h-1.5",
                  )}
                />
                <Panel
                  ref={slidesPanelRef}
                  defaultSize={
                    isBottomPanelCollapsed
                      ? SLIDES_COLLAPSED_SIZE
                      : slidesPanelSize
                  }
                  minSize={SLIDES_COLLAPSED_SIZE}
                  maxSize={40}
                  collapsible
                  collapsedSize={SLIDES_COLLAPSED_SIZE}
                  className="min-h-0"
                  onResize={(size) => {
                    if (slidesCollapseLock.current) return;

                    // Drag-open from collapsed strip
                    if (
                      isBottomPanelCollapsed &&
                      size > SLIDES_COLLAPSE_THRESHOLD
                    ) {
                      slidesCollapseLock.current = true;
                      setIsBottomPanelCollapsed(false);
                      setSlidesPanelSize(size);
                      window.setTimeout(() => {
                        slidesCollapseLock.current = false;
                      }, 150);
                      return;
                    }

                    if (
                      !isBottomPanelCollapsed &&
                      size >= SLIDES_COLLAPSE_THRESHOLD
                    ) {
                      setSlidesPanelSize(size);
                    }

                    if (
                      !isBottomPanelCollapsed &&
                      size < SLIDES_COLLAPSE_THRESHOLD
                    ) {
                      slidesCollapseLock.current = true;
                      setIsBottomPanelCollapsed(true);
                      try {
                        slidesPanelRef.current?.collapse();
                      } catch {
                        /* ignore */
                      }
                      window.setTimeout(() => {
                        slidesCollapseLock.current = false;
                      }, 200);
                    }
                  }}
                  onCollapse={() => setIsBottomPanelCollapsed(true)}
                  onExpand={() => setIsBottomPanelCollapsed(false)}
                >
                  <BottomSlidesPanel
                    project={project}
                    collapsed={isBottomPanelCollapsed}
                    onToggleCollapse={() => {
                      if (isBottomPanelCollapsed) expandSlidesPanel();
                      else collapseSlidesPanel();
                    }}
                  />
                </Panel>
              </>
            )}
          </PanelGroup>
        </div>
      )}

      <SettingsDrawer
        project={project}
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <CommandPalette
        projectId={project.id}
        onExport={() => exportMutation.mutate(project.id)}
        onAddSlide={() => createSlide.mutate({})}
        onTheme={(theme) => updateTheme.mutate(theme)}
      />
    </div>
  );
}
