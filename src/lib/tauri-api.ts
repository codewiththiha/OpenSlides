/**
 * Thin IPC bridge to the Rust backend.
 * All persistent mutations go through these helpers.
 */
import { invoke } from "@tauri-apps/api/core";
import type {
  Project,
  ProjectSummary,
  ProjectSettings,
  Slide,
} from "../types";

export type SlideSettingsPatch = Partial<{
  language: string;
  duration: number;
  transitionDuration: number;
  stagger: number;
}>;

export type SettingsPatch = Partial<ProjectSettings> & {
  theme?: string;
  currentSlideId?: string | null;
};

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (err) {
    const message = typeof err === "string" ? err : (err as Error)?.message ?? String(err);
    throw new Error(message);
  }
}

export const api = {
  getProjects: () => call<ProjectSummary[]>("get_projects"),

  getProject: (projectId: string) =>
    call<Project>("get_project", { projectId }),

  createProject: (name: string) =>
    call<Project>("create_project", { name }),

  renameProject: (projectId: string, name: string) =>
    call<Project>("rename_project", { projectId, name }),

  deleteProject: (projectId: string) =>
    call<void>("delete_project", { projectId }),

  updateProjectSettings: (projectId: string, settings: SettingsPatch) =>
    call<Project>("update_project_settings", { projectId, settings }),

  updateProjectTheme: (projectId: string, theme: string) =>
    call<Project>("update_project_theme", { projectId, theme }),

  createSlide: (projectId: string, opts?: { code?: string; language?: string }) =>
    call<Slide>("create_slide", {
      payload: {
        projectId,
        code: opts?.code,
        language: opts?.language,
      },
    }),

  deleteSlide: (projectId: string, slideId: string) =>
    call<Project>("delete_slide", { projectId, slideId }),

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
};
