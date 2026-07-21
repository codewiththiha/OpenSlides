/**
 * EditorToolbar — top TitleBar bar extracted from God Editor.
 * Only subscribes to the toolbar slice (saveStatus, autoplay, theme, zen)
 * so typing/localCode changes don't re-render it.
 */
import { memo, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Home,
  MonitorPlay,
  Play,
  Pause,
  Settings2,
  Download,
  Focus,
  Moon,
  Sun,
  Command as CommandIcon,
  Pencil,
} from "lucide-react";
import { Button } from "../ui/button";
import { TitleBar } from "../TitleBar";
import { SaveStatusBadge } from "./SaveStatusBadge";
import { InlineEditableText } from "../ui/inline-editable-text";
import { useToolbarSlice } from "@/store/ui-selectors";
import { useExportProject, useUpdateSlideSettings } from "@/hooks/queries";
import { modKeyLabel } from "@/lib/platform";
import { cn, formatDurationShort } from "@/lib/utils";
import { slideDisplayName } from "@/types";
import type { Project, Slide } from "@/types";

interface EditorToolbarProps {
  project: Project;
  activeSlide?: Slide;
  activeSlideIndex: number;
  onPresent: () => void;
}

export const EditorToolbar = memo(function EditorToolbar({
  project,
  activeSlide,
  activeSlideIndex,
  onPresent,
}: EditorToolbarProps) {
  const navigate = useNavigate();
  const {
    saveStatus,
    isAutoPlaying,
    toggleAutoPlaying,
    isDarkUi,
    toggleTheme,
    toggleZenMode,
    setIsSettingsOpen,
    setIsCommandOpen,
  } = useToolbarSlice();

  const exportMutation = useExportProject();
  const updateSlideSettings = useUpdateSlideSettings(project.id);
  const [editingSlideName, setEditingSlideName] = useState(false);
  const [slideNameDraft, setSlideNameDraft] = useState("");

  const activeSlideName = activeSlide
    ? slideDisplayName(activeSlide, activeSlideIndex)
    : "";
  const totalDurationMs = useMemo(
    () => project.slides.reduce((total, slide) => total + slide.duration, 0),
    [project.slides],
  );

  const commitSlideName = () => {
    if (!activeSlide) {
      setEditingSlideName(false);
      return;
    }
    const name = slideNameDraft.trim() || `Slide ${activeSlideIndex + 1}`;
    updateSlideSettings.mutate(
      { slideId: activeSlide.id, payload: { name } },
      { onSettled: () => setEditingSlideName(false) }
    );
  };

  const mod = modKeyLabel();

  return (
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
            <div
              className="truncate text-[10px] text-muted-foreground"
              title={`Estimated length: ${formatDurationShort(totalDurationMs)}`}
            >
              {project.slides.length} slide
              {project.slides.length !== 1 ? "s" : ""} · ~
              {formatDurationShort(totalDurationMs)} · {project.theme}
            </div>
          </div>
        </>
      }
      trailing={
        <>
          <div className="pointer-events-none absolute inset-x-0 flex items-center justify-center px-40">
            {editingSlideName ? (
              <InlineEditableText
                value={slideNameDraft}
                onChange={setSlideNameDraft}
                onCommit={commitSlideName}
                onCancel={() => setEditingSlideName(false)}
                stopPropagation={false}
                className="pointer-events-auto max-w-[16rem] truncate text-center text-xs font-medium"
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

          <SaveStatusBadge status={saveStatus} />

          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8",
              isAutoPlaying && "bg-primary/15 text-primary"
            )}
            title={
              isAutoPlaying
                ? "Pause autoplay"
                : "Play (auto-advance by slide duration)"
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
            title="Toggle light/dark mode"
            onClick={toggleTheme}
          >
            {isDarkUi ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title={`Focus mode (${mod}B)`}
            onClick={toggleZenMode}
          >
            <Focus className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Export"
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

          <Button size="sm" className="ml-1 gap-1.5" onClick={onPresent}>
            <MonitorPlay className="h-3.5 w-3.5" />
            Present
          </Button>
        </>
      }
    />
  );
});
