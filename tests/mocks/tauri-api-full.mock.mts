/**
 * Full in-memory mock of src/lib/tauri-api for the app-level jsdom suites
 * (present flow). Tests seed whole Project objects; every api.* read serves
 * from memory and every write mutates it, mirroring the Rust backend's
 * contracts closely enough for UI-level navigation tests.
 */
import type { Project, ProjectSummary, Slide } from "../../src/shared/types";
import { FALLBACK_SUPPORTED_LANGUAGES } from "../../src/shared/lib/language-meta";
import { THEMES } from "../../src/shared/lib/theme-meta";

let db = new Map<string, Project>();
let seq = 0;

export function seedProjects(projects: Project[]): void {
  db = new Map(projects.map((p) => [p.id, structuredClone(p)]));
}

export function resetFullApiMocks(): void {
  db = new Map();
  seq = 0;
}

function mustGet(projectId: string): Project {
  const p = db.get(projectId);
  if (!p) throw new Error(`mock db: no project ${projectId}`);
  return p;
}

function clone<T>(v: T): T {
  return structuredClone(v);
}

export const api = {
  getProjects: (): Promise<ProjectSummary[]> =>
    Promise.resolve(
      [...db.values()].map((p) => ({
        id: p.id,
        name: p.name,
        theme: p.theme,
        slideCount: p.slides.length,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        language: p.settings.language,
        firstSlideId: p.slides[0]?.id ?? "",
        firstSlideCode: p.slides[0]?.code ?? "",
        firstSlideThumbnail: p.slides[0]?.thumbnailHtml ?? "",
      })),
    ),

  getProject: (projectId: string) => Promise.resolve(clone(mustGet(projectId))),

  getDefaultSettings: () => Promise.resolve(clone(DEFAULT_SETTINGS)),

  getSupportedLanguages: () =>
    Promise.resolve(clone(FALLBACK_SUPPORTED_LANGUAGES)),

  getSupportedThemes: () => Promise.resolve(clone(THEMES)),

  createProject: (name: string) => {
    const p: Project = {
      id: `p${++seq}`,
      name,
      theme: "dark-plus",
      settings: clone(DEFAULT_SETTINGS),
      slides: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    db.set(p.id, p);
    return Promise.resolve(clone(p));
  },

  renameProject: (projectId: string, name: string) => {
    const p = mustGet(projectId);
    p.name = name;
    return Promise.resolve(clone(p));
  },

  duplicateProject: (projectId: string) => {
    const src = mustGet(projectId);
    const copy = clone(src);
    copy.id = `p${++seq}`;
    copy.name = `${src.name} copy`;
    db.set(copy.id, copy);
    return Promise.resolve(clone(copy));
  },

  deleteProject: (projectId: string) => {
    db.delete(projectId);
    return Promise.resolve();
  },

  updateProjectSettings: (projectId: string, settings: object) => {
    const p = mustGet(projectId);
    p.settings = { ...p.settings, ...(settings as object) };
    return Promise.resolve(clone(p));
  },

  updateProjectTheme: (projectId: string, theme: string) => {
    const p = mustGet(projectId);
    p.theme = theme;
    return Promise.resolve(clone(p));
  },

  createSlide: (projectId: string, opts?: { code?: string; name?: string }) => {
    const p = mustGet(projectId);
    const slide: Slide = {
      id: `s${++seq}`,
      code: opts?.code ?? "",
      language: p.settings.language,
      duration: 3000,
      transitionDuration: 300,
      stagger: 0,
      name: opts?.name ?? "",
      highlights: [],
    };
    p.slides.push(slide);
    return Promise.resolve(clone(slide));
  },

  deleteSlide: (projectId: string, slideId: string) => {
    const p = mustGet(projectId);
    p.slides = p.slides.filter((s) => s.id !== slideId);
    return Promise.resolve(clone(p));
  },

  duplicateSlide: (projectId: string, slideId: string) => {
    const p = mustGet(projectId);
    const i = p.slides.findIndex((s) => s.id === slideId);
    const copy = { ...clone(p.slides[i]), id: `s${++seq}` };
    p.slides.splice(i + 1, 0, copy);
    return Promise.resolve(clone(p));
  },

  restoreSlide: (projectId: string, slide: Slide, insertAt?: number) => {
    const p = mustGet(projectId);
    p.slides.splice(insertAt ?? p.slides.length, 0, clone(slide));
    return Promise.resolve(clone(p));
  },

  updateSlideCode: (slideId: string, code: string) => {
    for (const p of db.values()) {
      const s = p.slides.find((sl) => sl.id === slideId);
      if (s) {
        s.code = code;
        return Promise.resolve();
      }
    }
    return Promise.resolve();
  },

  cacheThumbnail: () => Promise.resolve(),

  updateSlideSettings: (slideId: string, payload: object) => {
    for (const p of db.values()) {
      const s = p.slides.find((sl) => sl.id === slideId);
      if (s) {
        Object.assign(s, payload);
        return Promise.resolve(clone(s));
      }
    }
    throw new Error(`mock db: no slide ${slideId}`);
  },

  reorderSlides: (projectId: string, slideIds: string[]) => {
    const p = mustGet(projectId);
    p.slides.sort((a, b) => slideIds.indexOf(a.id) - slideIds.indexOf(b.id));
    return Promise.resolve(clone(p));
  },

  setCurrentSlide: () => Promise.resolve(),

  exportProjectToJson: (projectId: string) =>
    Promise.resolve(JSON.stringify(mustGet(projectId))),

  importProjectFromJson: () => Promise.reject(new Error("not implemented")),

  searchSlides: () => Promise.resolve([] as string[]),

  stackProjects: () => Promise.resolve([] as ProjectSummary[]),
  unstackProjects: () => Promise.resolve([] as ProjectSummary[]),
  stackSlides: (projectId: string) =>
    api.getProject(projectId).then((p) => p.slides),
  unstackSlides: (projectId: string) =>
    api.getProject(projectId).then((p) => p.slides),
};

export function isCancelledError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { cancelled?: boolean }).cancelled === true
  );
}

export type SlideSettingsPatch = Record<string, unknown>;
export type SettingsPatch = Record<string, unknown>;

const DEFAULT_SETTINGS: Project["settings"] = {
  showLineNumbers: true,
  useBlackCodeBackground: false,
  showHighlightStepIndicator: false,
  fontSize: 16,
  lineHeight: 1.5,
  editorFontSize: 14,
  useGlobalTransition: true,
  globalTransitionDuration: 700,
  useGlobalStagger: true,
  globalStagger: 3,
  useGlobalHighlight: true,
  globalDimAmount: 80,
  globalSizeUpAmount: 105,
  highlightDimColor: "theme",
  currentSlideId: null,
  language: "typescript",
  codeAlign: "left",
};
