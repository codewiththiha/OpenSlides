/**
 * Thin IPC bridge to the Rust backend.
 * All persistent mutations go through these helpers.
 */
import { invoke } from "@tauri-apps/api/core";
import type { Project, ProjectSummary, ProjectSettings, Slide } from "../types";

export type SlideSettingsPatch = Partial<{
  duration: number;
  transitionDuration: number;
  stagger: number;
  name: string;
  highlights: import("../types").Highlight[];
}>;

export type SettingsPatch = Partial<ProjectSettings>;

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (err) {
    const message =
      typeof err === "string" ? err : (err as Error)?.message ?? String(err);
    throw new Error(message);
  }
}

export const api = {
  getProjects: () => call<ProjectSummary[]>("get_projects"),

  getProject: (projectId: string) => call<Project>("get_project", { projectId }),

  createProject: (name: string) => call<Project>("create_project", { name }),

  renameProject: (projectId: string, name: string) =>
    call<Project>("rename_project", { projectId, name }),

  deleteProject: (projectId: string) => call<void>("delete_project", { projectId }),

  updateProjectSettings: (projectId: string, settings: SettingsPatch) =>
    call<Project>("update_project_settings", { projectId, settings }),

  updateProjectTheme: (projectId: string, theme: string) =>
    call<Project>("update_project_theme", { projectId, theme }),

  createSlide: (projectId: string, opts?: { code?: string; name?: string }) =>
    call<Slide>("create_slide", {
      payload: {
        projectId,
        code: opts?.code,
        name: opts?.name,
      },
    }),

  deleteSlide: (projectId: string, slideId: string) =>
    call<Project>("delete_slide", { projectId, slideId }),

  restoreSlide: (projectId: string, slide: Slide, insertAt?: number) =>
    call<Project>("restore_slide", { projectId, slide, insertAt }),

  updateSlideCode: (slideId: string, code: string) =>
    call<void>("update_slide_code", { slideId, code }),

  updateSlideSettings: (slideId: string, payload: SlideSettingsPatch) =>
    call<Slide>("update_slide_settings", { slideId, payload }),

  reorderSlides: (projectId: string, slideIds: string[]) =>
    call<Project>("reorder_slides", { projectId, slideIds }),

  setCurrentSlide: (projectId: string, slideId: string) =>
    call<void>("set_current_slide", { projectId, slideId }),

  exportProjectToJson: (projectId: string) =>
    call<string>("export_project_to_json", { projectId }),

  importProjectFromJson: () => call<Project>("import_project_from_json"),

  /* ---- Highlight processing (Rust-side parsing) ---- */

  computeHighlightPlan: (req: {
    code: string;
    /** Full Shiki/Merustmar highlighted HTML of `code` ("" → plain fallback). */
    html: string;
    range: SelectionRange;
    themeBg: string;
    dimPercent: number;
  }) => call<HighlightPlan>("compute_highlight_plan", req),

  highlightSnippets: (code: string, ranges: SelectionRange[]) =>
    call<string[]>("highlight_snippets", { code, ranges }),

  selectionRange: (code: string, start: number, end: number) =>
    call<SelectionRange>("selection_range", { code, start, end }),
};

/* ----------------------------------------------------------------------- *
 * Highlight-processing DTOs (mirrors src-tauri/src/highlight.rs)
 * ----------------------------------------------------------------------- */

/** 0-based line/char span over the raw code (chars = JS string indices). */
export interface SelectionRange {
  startLine: number;
  startChar: number;
  endLine: number;
  endChar: number;
}

export interface HighlightPlanLine {
  /** 0-based index of this line in the source code. */
  lineIndex: number;
  /** Clamped selection bounds (UTF-16 units) inside this line. */
  startChar: number;
  endChar: number;
  /** Syntax-colored, tag-balanced HTML for the clone. */
  html: string;
  plainText: string;
  /** Nothing selected on this line — skip erase/clone, keep the entry. */
  isEmpty: boolean;
}

export interface HighlightPlan {
  lines: HighlightPlanLine[];
  /** Dimmed-card color the eraser boxes must paint (mixed in Rust). */
  eraserColor: string;
  selectedText: string;
}
