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
import { useShallow } from "zustand/react/shallow";
import {
  Home,
  MonitorPlay,
  Play,
  Pause,
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
  Pencil,
} from "lucide-react";
import { Button } from "./ui/button";
import { TitleBar } from "./TitleBar";
import { SlidePreview } from "./SlidePreview";
import { CodeEditor } from "./CodeEditor";
import { BottomSlidesPanel } from "./BottomSlidesPanel";
import { SettingsDrawer } from "./SettingsDrawer";
import { CommandPalette } from "./CommandPalette";
import { ShortcutsHelp } from "./ShortcutsHelp";
import { useUiStore } from "@/store/useUiStore";
import {
  useProject,
  useExportProject,
  useCreateSlide,
  useUpdateTheme,
  useCreateProject,
  useUpdateSlideSettings,
} from "@/hooks/queries";
import { useCollapsiblePanel } from "@/hooks/useCollapsiblePanel";
import { isModKey, isTypingTarget } from "@/lib/keyboard";
import { api } from "@/lib/tauri-api";
import { cn } from "@/lib/utils";
import { modKeyLabel } from "@/lib/platform";
import { useAppMenu } from "@/hooks/useAppMenu";
import { useHighlightNav } from "@/hooks/useHighlightNav";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { slideDisplayName } from "@/types";
import { HighlightStepIndicator } from "./HighlightStepIndicator";

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

  // Whole-store destructure would re-render the ENTIRE editor tree (title
  // bar, panels, preview, strip) on every keystroke / saveStatus cycle.
  // useShallow re-renders only when one of these specific fields changes.
  const {
    currentSlideId,
    setCurrentSlideId,
    isPresenting,
    setIsPresenting,
    isAutoPlaying,
    setIsAutoPlaying,
    toggleAutoPlaying,
    isZenMode,
    toggleZenMode,
    isSettingsOpen,
    setIsSettingsOpen,
    isCommandOpen,
    setIsCommandOpen,
    isShortcutsOpen,
    setIsShortcutsOpen,
    toggleShortcutsOpen,
    isDarkUi,
    toggleTheme,
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
    previewHighlightIndex,
  } = useUiStore(
    useShallow((s) => ({
      currentSlideId: s.currentSlideId,
      setCurrentSlideId: s.setCurrentSlideId,
      isPresenting: s.isPresenting,
      setIsPresenting: s.setIsPresenting,
      isAutoPlaying: s.isAutoPlaying,
      setIsAutoPlaying: s.setIsAutoPlaying,
      toggleAutoPlaying: s.toggleAutoPlaying,
      isZenMode: s.isZenMode,
      toggleZenMode: s.toggleZenMode,
      isSettingsOpen: s.isSettingsOpen,
      setIsSettingsOpen: s.setIsSettingsOpen,
      isCommandOpen: s.isCommandOpen,
      setIsCommandOpen: s.setIsCommandOpen,
      isShortcutsOpen: s.isShortcutsOpen,
      setIsShortcutsOpen: s.setIsShortcutsOpen,
      toggleShortcutsOpen: s.toggleShortcutsOpen,
      isDarkUi: s.isDarkUi,
      toggleTheme: s.toggleTheme,
      saveStatus: s.saveStatus,
      resetEditorUi: s.resetEditorUi,
      isBottomPanelCollapsed: s.isBottomPanelCollapsed,
      setIsBottomPanelCollapsed: s.setIsBottomPanelCollapsed,
      isCodePanelCollapsed: s.isCodePanelCollapsed,
      setIsCodePanelCollapsed: s.setIsCodePanelCollapsed,
      codePanelSize: s.codePanelSize,
      setCodePanelSize: s.setCodePanelSize,
      slidesPanelSize: s.slidesPanelSize,
      setSlidesPanelSize: s.setSlidesPanelSize,
      previewHighlightIndex: s.previewHighlightIndex,
    })),
  );

  const exportMutation = useExportProject();
  const createSlide = useCreateSlide(projectId ?? "");
  const updateTheme = useUpdateTheme(projectId ?? "");
  const createProject = useCreateProject();
  const updateSlideSettings = useUpdateSlideSettings(projectId ?? "");
  const [editorExpanded, setEditorExpanded] = useState(false);
  const [editingSlideName, setEditingSlideName] = useState(false);
  const [slideNameDraft, setSlideNameDraft] = useState("");

  const codePanelRef = useRef<ImperativePanelHandle>(null);
  const slidesPanelRef = useRef<ImperativePanelHandle>(null);

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

  // Panel rails: imperative collapse state ⇆ persisted store, expand
  // restores last size, collapse snapshots it first, onResize auto-collapses
  // on drag (shared logic).
  const {
    expand: expandCodePanel,
    collapse: collapseCodePanel,
    onResize: onCodePanelResize,
  } = useCollapsiblePanel({
    panelRef: codePanelRef,
    isCollapsed: isCodePanelCollapsed,
    setCollapsed: setIsCodePanelCollapsed,
    size: codePanelSize,
    setSize: setCodePanelSize,
    collapseThreshold: CODE_COLLAPSE_THRESHOLD,
  });

  const {
    expand: expandSlidesPanel,
    collapse: collapseSlidesPanel,
    onResize: onSlidesPanelResize,
  } = useCollapsiblePanel({
    panelRef: slidesPanelRef,
    isCollapsed: isBottomPanelCollapsed,
    setCollapsed: setIsBottomPanelCollapsed,
    size: slidesPanelSize,
    setSize: setSlidesPanelSize,
    collapseThreshold: SLIDES_COLLAPSE_THRESHOLD,
  });

  const slides = project?.slides ?? [];
  const currentIndex = slides.findIndex((s) => s.id === currentSlideId);

  // Highlight navigation: each →/click steps intro→crossfade→…→outro,
  // and only shifts the slide after the final outro actually finished.
  const {
    highlightIndex: activeHighlightIndex,
    goNext: goNextSlide,
    goPrev: goPrevSlide,
    handleExitComplete: handleHighlightExitComplete,
  } = useHighlightNav({
    slides,
    currentIndex,
    currentSlideId,
    setCurrentSlideId,
  });

  // Auto-play: advance after each slide's duration (ms). Stepping through
  // highlights goes through the same goNext as manual nav, so every intro,
  // crossfade and the closing outro all play before the slide moves on.
  useEffect(() => {
    if (!isAutoPlaying || !project) return;
    if (slides.length === 0 || currentIndex < 0) return;

    const ms = Math.max(500, slides[currentIndex]?.duration ?? 3000);
    const timer = window.setTimeout(() => {
      const acted = goNextSlide();
      if (!acted) setIsAutoPlaying(false); // deck finished
    }, ms);

    return () => window.clearTimeout(timer);
  }, [
    isAutoPlaying,
    project,
    slides,
    currentIndex,
    activeHighlightIndex,
    goNextSlide,
    setIsAutoPlaying,
  ]);

  // Stop autoplay when leaving the editor / starting present is fine to keep;
  // stop when presentation exits is handled in exitPresent.
  useEffect(() => {
    return () => setIsAutoPlaying(false);
  }, [setIsAutoPlaying]);

  const exitPresent = useCallback(async () => {
    setIsPresenting(false);
    setIsAutoPlaying(false);
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
  }, [setIsPresenting, setIsAutoPlaying]);

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
          // Manual nav pauses autoplay so timers don't fight the user
          setIsAutoPlaying(false);
          goNextSlide();
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          setIsAutoPlaying(false);
          goPrevSlide();
        } else if (e.key.toLowerCase() === "p" && !isModKey(e)) {
          e.preventDefault();
          toggleAutoPlaying();
        }
        return;
      }

      if (e.key === "Escape") {
        if (isShortcutsOpen) {
          e.preventDefault();
          setIsShortcutsOpen(false);
          return;
        }
        if (isZenMode) {
          e.preventDefault();
          toggleZenMode();
        }
      }

      if (isModKey(e) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleZenMode();
      }

      // `?` opens shortcuts help (Shift+/). Ignore when typing.
      if (
        e.key === "?" &&
        !isModKey(e) &&
        !e.altKey &&
        !isTypingTarget(e.target) &&
        !isCommandOpen
      ) {
        e.preventDefault();
        toggleShortcutsOpen();
        return;
      }

      // Normal / zen: arrow keys navigate slides when not typing in an input
      if (
        (e.key === "ArrowRight" || e.key === "ArrowLeft") &&
        !isTypingTarget(e.target) &&
        !isModKey(e) &&
        !e.altKey &&
        !isSettingsOpen &&
        !isCommandOpen &&
        !isShortcutsOpen
      ) {
        e.preventDefault();
        setIsAutoPlaying(false);
        if (e.key === "ArrowRight") goNextSlide();
        else goPrevSlide();
      }
    },
    [
      isPresenting,
      isZenMode,
      isSettingsOpen,
      isCommandOpen,
      isShortcutsOpen,
      exitPresent,
      goNextSlide,
      goPrevSlide,
      toggleZenMode,
      setIsShortcutsOpen,
      toggleShortcutsOpen,
      setIsAutoPlaying,
      toggleAutoPlaying,
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
      "menu://shortcuts": () => setIsShortcutsOpen(true),
      "menu://undo": () => {
        window.dispatchEvent(new Event("openslides:undo"));
      },
      "menu://redo": () => {
        window.dispatchEvent(new Event("openslides:redo"));
      },
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
      setIsShortcutsOpen,
    ],
  );
  useAppMenu(menuHandlers);

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
  const activeSlide =
    project.slides.find((s) => s.id === currentSlideId) ?? project.slides[0];
  const activeSlideIndex = Math.max(
    0,
    project.slides.findIndex((s) => s.id === activeSlide?.id),
  );
  const activeSlideName = activeSlide
    ? slideDisplayName(activeSlide, activeSlideIndex)
    : "";

  const commitSlideName = () => {
    if (!activeSlide) {
      setEditingSlideName(false);
      return;
    }
    const name = slideNameDraft.trim() || `Slide ${activeSlideIndex + 1}`;
    updateSlideSettings.mutate(
      { slideId: activeSlide.id, payload: { name } },
      { onSettled: () => setEditingSlideName(false) },
    );
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {!isZenMode && !isPresenting && (
        <TitleBar
          className="relative"
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
              <div className="pointer-events-none absolute inset-x-0 flex items-center justify-center px-40">
                {editingSlideName ? (
                  <input
                    className="pointer-events-auto h-7 max-w-[16rem] truncate rounded-md border border-input bg-background px-2 text-center text-xs font-medium outline-none focus:ring-1 focus:ring-ring"
                    value={slideNameDraft}
                    autoFocus
                    onChange={(e) => setSlideNameDraft(e.target.value)}
                    onBlur={commitSlideName}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitSlideName();
                      if (e.key === "Escape") setEditingSlideName(false);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="group/name pointer-events-auto inline-flex max-w-[16rem] items-center gap-1.5 truncate rounded-md px-2.5 py-1 text-center text-xs font-medium text-foreground/90 transition-colors hover:bg-muted/70"
                    title="Rename current slide"
                    onClick={() => {
                      setSlideNameDraft(activeSlideName);
                      setEditingSlideName(true);
                    }}
                  >
                    <span className="truncate">{activeSlideName}</span>
                    <Pencil className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/name:opacity-100" />
                  </button>
                )}
              </div>

              {saveBadge}
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8", isAutoPlaying && "bg-primary/15 text-primary")}
                title={
                  isAutoPlaying
                    ? "Pause autoplay"
                    : "Play slides (uses each slide’s duration)"
                }
                onClick={() => toggleAutoPlaying()}
              >
                {isAutoPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
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
          <div className="absolute right-4 top-4 z-[110] flex items-center gap-2">
            <button
              type="button"
              className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 text-sm text-white/70 transition hover:bg-white/20 hover:text-white"
              onClick={() => toggleAutoPlaying()}
              title={isAutoPlaying ? "Pause autoplay" : "Play (auto-advance)"}
            >
              {isAutoPlaying ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {isAutoPlaying ? "Pause" : "Play"}
              </span>
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 text-sm text-white/70 transition hover:bg-white/20 hover:text-white"
              onClick={() => void exitPresent()}
            >
              Press{" "}
              <kbd className="rounded bg-white/20 px-2 py-0.5 font-mono text-xs">
                ESC
              </kbd>{" "}
              to exit
            </button>
          </div>
          {/* Full-bleed stage (true fullscreen when API available).
              Click = next step (highlight or slide), right-click = back. */}
          <div
            className="flex h-full w-full cursor-pointer items-center justify-center p-0 sm:p-4"
            onClick={() => {
              setIsAutoPlaying(false);
              goNextSlide();
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setIsAutoPlaying(false);
              goPrevSlide();
            }}
          >
            <div className="relative aspect-video h-full max-h-full w-full max-w-full">
              <SlidePreview
                project={project}
                isPresenting
                activeHighlightIndex={activeHighlightIndex}
                onHighlightExitComplete={handleHighlightExitComplete}
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-4 z-40 flex justify-center">
                <HighlightStepIndicator
                  total={activeSlide?.highlights?.length ?? 0}
                  current={activeHighlightIndex}
                />
              </div>
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
                    <div className="relative aspect-video h-full max-h-full w-full max-w-full">
                      <SlidePreview
                        project={project}
                        activeHighlightIndex={
                          previewHighlightIndex >= 0
                            ? previewHighlightIndex
                            : activeHighlightIndex
                        }
                        onHighlightExitComplete={handleHighlightExitComplete}
                      />
                      <div className="pointer-events-none absolute inset-x-0 bottom-2.5 z-40 flex justify-center">
                        <HighlightStepIndicator
                          compact
                          total={activeSlide?.highlights?.length ?? 0}
                          current={
                            previewHighlightIndex >= 0
                              ? previewHighlightIndex
                              : activeHighlightIndex
                          }
                        />
                      </div>
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
                      onResize={onCodePanelResize}
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
                  onResize={onSlidesPanelResize}
                  onCollapse={() => setIsBottomPanelCollapsed(true)}
                  onExpand={() => setIsBottomPanelCollapsed(false)}
                >
                  <BottomSlidesPanel
                    project={project}
                    collapsed={isBottomPanelCollapsed}
                    activeHighlightIndex={activeHighlightIndex}
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

      <ShortcutsHelp />
    </div>
  );
}
