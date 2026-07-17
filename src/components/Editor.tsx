/**
 * Main editor workspace —
 * single toolbar, resizable preview/editor + slides strip,
 * auto-collapse when panels are dragged too narrow,
 * zen mode, presentation overlay, native menu integration.
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
  PanelRightOpen,
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
    setIsCommandOpen,
    isDarkUi,
    setIsDarkUi,
    saveStatus,
    resetEditorUi,
    isBottomPanelCollapsed,
    setIsBottomPanelCollapsed,
    isCodePanelCollapsed,
    setIsCodePanelCollapsed,
  } = useUiStore();

  const exportMutation = useExportProject();
  const createSlide = useCreateSlide(projectId ?? "");
  const updateTheme = useUpdateTheme(projectId ?? "");
  const createProject = useCreateProject();
  const [editorExpanded, setEditorExpanded] = useState(false);

  const codePanelRef = useRef<ImperativePanelHandle>(null);
  const slidesPanelRef = useRef<ImperativePanelHandle>(null);
  // Avoid thrashing collapse while the user is mid-drag near the threshold
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

  // Keep imperative panel sizes in sync when collapsed via button
  useEffect(() => {
    const panel = codePanelRef.current;
    if (!panel) return;
    if (isCodePanelCollapsed) {
      try {
        panel.collapse();
      } catch {
        /* ignore */
      }
    } else {
      try {
        if (panel.isCollapsed()) panel.expand();
      } catch {
        /* ignore */
      }
    }
  }, [isCodePanelCollapsed]);

  useEffect(() => {
    const panel = slidesPanelRef.current;
    if (!panel) return;
    if (isBottomPanelCollapsed) {
      try {
        panel.collapse();
      } catch {
        /* ignore */
      }
    } else {
      try {
        if (panel.isCollapsed()) panel.expand();
      } catch {
        /* ignore */
      }
    }
  }, [isBottomPanelCollapsed]);

  const slides = project?.slides ?? [];
  const currentIndex = slides.findIndex((s) => s.id === currentSlideId);

  const toggleTheme = useCallback(() => {
    const next = !isDarkUi;
    setIsDarkUi(next);
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.classList.toggle("light", !next);
  }, [isDarkUi, setIsDarkUi]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isPresenting) {
        if (e.key === "Escape") {
          e.preventDefault();
          setIsPresenting(false);
        } else if (e.key === "ArrowRight" || e.key === " ") {
          e.preventDefault();
          if (currentIndex < slides.length - 1) {
            setCurrentSlideId(slides[currentIndex + 1].id);
          }
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          if (currentIndex > 0) {
            setCurrentSlideId(slides[currentIndex - 1].id);
          }
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
    },
    [
      isPresenting,
      isZenMode,
      currentIndex,
      slides,
      setIsPresenting,
      setCurrentSlideId,
      toggleZenMode,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

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
      "menu://present": () => setIsPresenting(true),
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
      setIsPresenting,
      toggleZenMode,
      setIsSettingsOpen,
      setIsCommandOpen,
      createSlide,
      toggleTheme,
    ],
  );
  useAppMenu(menuHandlers);

  const expandCodePanel = () => {
    setIsCodePanelCollapsed(false);
    requestAnimationFrame(() => {
      try {
        codePanelRef.current?.expand();
        codePanelRef.current?.resize(40);
      } catch {
        /* ignore */
      }
    });
  };

  const collapseCodePanel = () => {
    setIsCodePanelCollapsed(true);
    try {
      codePanelRef.current?.collapse();
    } catch {
      /* ignore */
    }
  };

  const expandSlidesPanel = () => {
    setIsBottomPanelCollapsed(false);
    requestAnimationFrame(() => {
      try {
        slidesPanelRef.current?.expand();
        slidesPanelRef.current?.resize(20);
      } catch {
        /* ignore */
      }
    });
  };

  const collapseSlidesPanel = () => {
    setIsBottomPanelCollapsed(true);
    try {
      slidesPanelRef.current?.collapse();
    } catch {
      /* ignore */
    }
  };

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
              {isCodePanelCollapsed && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  title="Show code editor"
                  onClick={expandCodePanel}
                >
                  <PanelRightOpen className="h-3.5 w-3.5" />
                  <Code2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Code</span>
                </Button>
              )}
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
                onClick={() => setIsPresenting(true)}
              >
                <MonitorPlay className="h-3.5 w-3.5" />
                Present
              </Button>
            </>
          }
        />
      )}

      {isPresenting && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black">
          <button
            type="button"
            className="absolute right-4 top-4 z-[110] flex items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 text-sm text-white/70 transition hover:bg-white/20 hover:text-white"
            onClick={() => setIsPresenting(false)}
          >
            Press{" "}
            <kbd className="rounded bg-white/20 px-2 py-0.5 font-mono text-xs">ESC</kbd>{" "}
            to exit
          </button>
          <div className="aspect-video h-full max-h-[90vh] w-full max-w-[90vw]">
            <SlidePreview project={project} isPresenting />
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
                <Panel defaultSize={isCodePanelCollapsed ? 100 : 58} minSize={30} className="min-w-0">
                  <div className="flex h-full items-center justify-center bg-muted/20 p-4 pb-5">
                    <div className="aspect-video h-full max-h-full w-full max-w-full">
                      <SlidePreview project={project} />
                    </div>
                  </div>
                </Panel>

                {!isZenMode && (
                  <>
                    <PanelResizeHandle
                      className={cn(
                        "w-1 bg-border/60 transition-colors hover:bg-primary/50 data-[resize-handle-active]:bg-primary/60",
                        isCodePanelCollapsed && "pointer-events-none opacity-0 w-0",
                      )}
                      disabled={isCodePanelCollapsed}
                    />

                    <Panel
                      ref={codePanelRef}
                      defaultSize={isCodePanelCollapsed ? 0 : 42}
                      minSize={isCodePanelCollapsed ? 0 : 18}
                      collapsible
                      collapsedSize={0}
                      className="min-w-0"
                      onResize={(size) => {
                        if (codeCollapseLock.current) return;
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
                      {!isCodePanelCollapsed && (
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
                <PanelResizeHandle
                  className={cn(
                    "h-1.5 bg-border/60 transition-colors hover:bg-primary/50 data-[resize-handle-active]:bg-primary/60",
                    isBottomPanelCollapsed && "h-1",
                  )}
                />
                <Panel
                  ref={slidesPanelRef}
                  defaultSize={isBottomPanelCollapsed ? 4 : 22}
                  minSize={isBottomPanelCollapsed ? 4 : 12}
                  maxSize={isBottomPanelCollapsed ? 6 : 40}
                  collapsible
                  collapsedSize={4}
                  className="min-h-0"
                  onResize={(size) => {
                    if (slidesCollapseLock.current) return;
                    if (!isBottomPanelCollapsed && size < SLIDES_COLLAPSE_THRESHOLD) {
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
