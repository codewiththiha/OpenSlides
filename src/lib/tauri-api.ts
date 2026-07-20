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

/**
 * Error thrown for failed Tauri commands. Rust can attach a machine-readable
 * `code` (see IoCommandError in src-tauri/src/commands/io.rs, which
 * serializes as `{ "code": "CANCELLED" | "ERROR", "message": string }`) so
 * callers can branch on the failure kind instead of matching message text
 * across the IPC bridge.
 */
export interface CommandError extends Error {
  code?: string;
}

function normalizeCommandError(err: unknown): CommandError {
  // Structured backend error: { code, message }
  if (typeof err === "object" && err !== null) {
    const e = err as { code?: unknown; message?: unknown };
    if (typeof e.message === "string") {
      const out: CommandError = new Error(e.message);
      if (typeof e.code === "string") out.code = e.code;
      return out;
    }
  }
  // Plain string rejection (most Rust commands still map_err(String)).
  if (typeof err === "string") return new Error(err);
  return new Error((err as Error)?.message ?? String(err));
}

/** True when the backend reported a user cancellation (e.g. closing the
 *  native save/open dialog) — callers stay silent for these instead of
 *  showing an error toast. */
export function isCancelledError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === "CANCELLED"
  );
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (err) {
    throw normalizeCommandError(err);
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

  duplicateSlide: (projectId: string, slideId: string) =>
    call<Project>("duplicate_slide", { projectId, slideId }),

  restoreSlide: (projectId: string, slide: Slide, insertAt?: number) =>
    call<Project>("restore_slide", { projectId, slide, insertAt }),

  updateSlideCode: (slideId: string, code: string) =>
    call<void>("update_slide_code", { slideId, code }),

  cacheThumbnail: (slideId: string, code: string, html: string) =>
    call<void>("cache_thumbnail", { slideId, code, html }),

  updateSlideSettings: (slideId: string, payload: SlideSettingsPatch) =>
    call<Slide>("update_slide_settings", { slideId, payload }),

  reorderSlides: (projectId: string, slideIds: string[]) =>
    call<Project>("reorder_slides", { projectId, slideIds }),

  setCurrentSlide: (projectId: string, slideId: string) =>
    call<void>("set_current_slide", { projectId, slideId }),

  exportProjectToJson: (projectId: string) =>
    call<string>("export_project_to_json", { projectId }),

  importProjectFromJson: () => call<Project>("import_project_from_json"),

  searchSlides: (projectId: string, query: string) =>
    call<string[]>("search_slides", { projectId, query }),

};

/* Highlight DTOs (SelectionRange, HighlightPlan, HighlightTokenLine …) now
 * live in src/lib/highlight-tokens.ts — the plan is built client-side. */
