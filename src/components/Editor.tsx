/**
 * Editor — orchestrator, no longer a God component.
 *
 * Before: 939 lines handling routing, 25 store selectors, keyboard,
 * panels, present, menus, autoplay, fullscreen.
 * After: ~200 lines, delegates to:
 *  - EditorToolbar (TitleBar + save badge + slide name + actions)
 *  - EditorLayout (resizable preview/code/slides)
 *  - PresentOverlay (fullscreen stage)
 *  - useEditorKeyboard (3 deps, getState() inside)
 *  - usePresentFullscreen (enter/exit/fullscreenchange)
 *  - Zustand slices defined in ui-selectors.ts outside components
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useEditorSlice } from "@/store/ui-selectors";
import { useSlideMaps } from "@/hooks/useSlideMaps";
import { Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { TitleBar } from "./TitleBar";
import { SettingsDrawer } from "./SettingsDrawer";
import { CommandPalette } from "./CommandPalette";
import { ShortcutsHelp } from "./ShortcutsHelp";
import { GoToSlideDialog } from "./GoToSlideDialog";
import { EditorToolbar } from "./editor/EditorToolbar";
import { EditorLayout } from "./editor/EditorLayout";
import { PresentOverlay } from "./editor/PresentOverlay";
import { useUiStore } from "@/store/useUiStore";
import {
  useProject,
  useCreateSlide,
  useDuplicateSlide,
  useCreateProject,
  useExportProject,
  useUpdateTheme,
} from "@/hooks/queries";
import { api } from "@/lib/tauri-api";
import { useAppMenu } from "@/hooks/useAppMenu";
import { useHighlightNav } from "@/hooks/useHighlightNav";
import { useEditorKeyboard } from "@/hooks/useEditorKeyboard";
import { usePresentFullscreen } from "@/hooks/usePresentFullscreen";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { dismissAllUndoToasts } from "@/lib/settings-undo";

export function Editor() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  // -- Only the slices this orchestrator actually needs --
  const {
    currentSlideId,
    setCurrentSlideId,
    isPresenting,
    isZenMode,
    isSettingsOpen,
    setIsSettingsOpen,
    resetEditorUi,
    previewHighlightIndex,
    isAutoPlaying,
    setIsAutoPlaying,
  } = useEditorSlice();

  // Project data (TanStack) — owns slides / theme / settings
  const { data: project, isLoading, isError, error } = useProject(projectId);

  const exportMutation = useExportProject();
  const createSlide = useCreateSlide(projectId ?? "");
  const duplicateSlide = useDuplicateSlide(projectId ?? "");
  const updateTheme = useUpdateTheme(projectId ?? "");
  const createProject = useCreateProject();
  const createProjectRef = useRef(createProject);
  const exportMutationRef = useRef(exportMutation);
  const createSlideRef = useRef(createSlide);
  const duplicateSlideRef = useRef(duplicateSlide);
  createProjectRef.current = createProject;
  exportMutationRef.current = exportMutation;
  createSlideRef.current = createSlide;
  duplicateSlideRef.current = duplicateSlide;

  const [editorExpanded, setEditorExpanded] = useState(false);

  // -- Side effects: title, initial slide, debounced currentSlide persistence --
  useEffect(() => {
    const title = project ? `OpenSlides — ${project.name}` : "OpenSlides";
    document.title = title;
    getCurrentWindow()
      .setTitle(title)
      .catch(() => undefined);
  }, [project]);

  useEffect(() => {
    if (!project) return;
    if (
      !currentSlideId ||
      !project.slides.some((s) => s.id === currentSlideId)
    ) {
      const id =
        project.settings.currentSlideId ?? project.slides[0]?.id ?? null;
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
    // Clear transient preview overrides and stale setting undos on project switch.
    useUiStore.getState().clearAllPreviewSettings();
    dismissAllUndoToasts();
  }, [projectId]);

  useEffect(() => {
    return () => resetEditorUi();
  }, [resetEditorUi]);

  // -- Highlight navigation (stable callbacks via refs internally) --
  const slides = project?.slides ?? [];

  // O(1) lookup via Map instead of O(n) find per render (200 slides = 200 scans per render)
  const { slideMap, indexMap } = useSlideMaps(slides);

  const currentIndex = currentSlideId ? (indexMap.get(currentSlideId) ?? -1) : -1;
  const activeSlide = (currentSlideId ? slideMap.get(currentSlideId) : undefined) ?? slides[0];

  const {
    highlightIndex: activeHighlightIndex,
    goNext: goNextSlide,
    goPrev: goPrevSlide,
    goToHighlight: goToHighlightSlide,
    handleExitComplete: handleHighlightExitComplete,
  } = useHighlightNav({
    slides,
    currentIndex,
    currentSlideId,
    setCurrentSlideId,
  });

  // -- Fullscreen present (extracted) --
  const { enterPresent, exitPresent } = usePresentFullscreen();

  // -- Keyboard (now 4 deps, still stable — number keys 1-9 jump to highlight) --
  useEditorKeyboard({
    goNext: goNextSlide,
    goPrev: goPrevSlide,
    goToHighlight: goToHighlightSlide,
    exitPresent,
  });

  // -- Auto-play: advance after each slide duration, respects highlights via goNext --
  useEffect(() => {
    if (!isAutoPlaying || !project) return;
    if (slides.length === 0 || currentIndex < 0) return;

    const ms = Math.max(500, slides[currentIndex]?.duration ?? 3000);
    const timer = window.setTimeout(() => {
      const acted = goNextSlide();
      if (!acted) setIsAutoPlaying(false);
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

  useEffect(() => {
    return () => setIsAutoPlaying(false);
  }, [setIsAutoPlaying]);

  // -- Native app menu --
  const menuHandlers = useMemo(
    () => ({
      "menu://new-project": () => {
        void createProjectRef.current.mutateAsync("Untitled Deck").then((p) => {
          navigate(`/editor/${p.id}`);
        });
      },
      "menu://open-dashboard": () => navigate("/"),
      "menu://export": () => {
        if (projectId) exportMutationRef.current.mutate(projectId);
      },
      "menu://present": () => void enterPresent(),
      "menu://zen": () => useUiStore.getState().toggleZenMode(),
      "menu://settings": () => setIsSettingsOpen(true),
      "menu://command-palette": () =>
        useUiStore.getState().setIsCommandOpen(true),
      "menu://add-slide": () => {
        if (projectId) createSlideRef.current.mutate({});
      },
      "menu://duplicate-slide": () => {
        if (projectId && currentSlideId) duplicateSlideRef.current.mutate(currentSlideId);
      },
      "menu://toggle-theme": () => useUiStore.getState().toggleTheme(),
      "menu://shortcuts": () =>
        useUiStore.getState().setIsShortcutsOpen(true),
      "menu://undo": () => {
        window.dispatchEvent(new Event("openslides:undo"));
      },
      "menu://redo": () => {
        window.dispatchEvent(new Event("openslides:redo"));
      },
    }),
    [
      navigate,
      projectId,
      currentSlideId,
      enterPresent,
      setIsSettingsOpen,
    ]
  );
  useAppMenu(menuHandlers);

  // -- Loading / error --
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

  return (
    <div className="flex h-full flex-col bg-background">
      {!isZenMode && !isPresenting && (
        <EditorToolbar
          project={project}
          activeSlide={activeSlide}
          activeSlideIndex={Math.max(0, currentIndex)}
          onPresent={() => void enterPresent()}
        />
      )}

      {isPresenting && (
        <PresentOverlay
          project={project}
          activeSlide={activeSlide}
          activeHighlightIndex={activeHighlightIndex}
          onHighlightExitComplete={handleHighlightExitComplete}
          goNext={goNextSlide}
          goPrev={goPrevSlide}
          goToHighlight={goToHighlightSlide}
          exitPresent={exitPresent}
        />
      )}

      {isZenMode && !isPresenting && (
        <button
          type="button"
          onClick={() => useUiStore.getState().toggleZenMode()}
          className="absolute right-3 top-3 z-30 rounded-md bg-card/80 px-2 py-1 text-[11px] text-muted-foreground shadow backdrop-blur hover:text-foreground"
        >
          Exit Zen (Esc)
        </button>
      )}

      {!isPresenting && (
        <EditorLayout
          project={project}
          activeSlide={activeSlide}
          activeHighlightIndex={activeHighlightIndex}
          previewHighlightIndex={previewHighlightIndex}
          onHighlightExitComplete={handleHighlightExitComplete}
          onSelectHighlight={goToHighlightSlide}
          editorExpanded={editorExpanded}
          onToggleEditorExpanded={setEditorExpanded}
        />
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
      <GoToSlideDialog project={project} />

      <ShortcutsHelp />
    </div>
  );
}
