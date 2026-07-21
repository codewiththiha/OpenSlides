import {
  Maximize2,
  Minimize2,
  PanelRightClose,
  Highlighter as HighlighterIcon,
  Search,
} from "lucide-react";
import { Button } from "../ui/button";
import { SelectField } from "../ui/select-field";
import { EditorSlideNav } from "./EditorSlideNav";
import { cn } from "@/lib/utils";
import { SUPPORTED_LANGUAGES } from "@/types";
import type { Project } from "@/types";

interface CodeEditorHeaderProps {
  project: Project;
  currentIndex: number;
  language: string;
  highlightMode: boolean;
  highlightCount: number;
  expanded: boolean | undefined;
  onNavigate: (dir: -1 | 1) => void;
  onLanguageChange: (value: string) => void;
  onToggleHighlightMode: () => void;
  onToggleExpand: (() => void) | undefined;
  onCollapse: (() => void) | undefined;
  onToggleFind: () => void;
}

export function CodeEditorHeader({
  project,
  currentIndex,
  language,
  highlightMode,
  highlightCount,
  expanded,
  onNavigate,
  onLanguageChange,
  onToggleHighlightMode,
  onToggleExpand,
  onCollapse,
  onToggleFind,
}: CodeEditorHeaderProps) {
  return (
    <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b px-2">
      <EditorSlideNav index={currentIndex} total={project.slides.length} onNavigate={onNavigate} />

      <div className="flex min-w-0 items-center gap-1">
        <SelectField
          selectSize="sm"
          options={SUPPORTED_LANGUAGES}
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          title="Code language"
        />

        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative h-7 w-7 shrink-0",
            highlightMode && "bg-primary/15 text-primary",
          )}
          onClick={onToggleHighlightMode}
          title={
            highlightMode
              ? "Highlight mode is on — select code and right-click to add a highlight"
              : "Toggle highlight mode"
          }
        >
          <HighlighterIcon className="h-3.5 w-3.5" />
          {highlightCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3 min-w-3 items-center justify-center rounded-full bg-primary px-0.5 text-[8px] font-semibold leading-none text-primary-foreground">
              {highlightCount}
            </span>
          )}
        </Button>

        {onToggleExpand && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={onToggleExpand}
            title={expanded ? "Exit expanded view" : "Expand editor"}
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
          className="h-7 w-7 shrink-0"
          onClick={onToggleFind}
          title="Find/Replace (Cmd+F)"
        >
          <Search className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
