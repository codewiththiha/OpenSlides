/**
 * Editor route state: project query + title/selection lifecycle effects.
 *
 * `pid` is captured once (the route wrapper keys EditorInner on it), so the
 * project-scoped query and the route effects live as long as the editor.
 */
import {
  ui,
  setCurrentSlideId,
  clearAllPreviewSettings,
  resetEditorUi,
} from "$lib/stores/ui-state.svelte";
import { projectQuery } from "$lib/queries";
import { api } from "$lib/lib/tauri-api";
import { setWindowTitle } from "$lib/lib/window-title";
import { logger } from "$lib/lib/logger";
import { dismissAllUndoToasts } from "$lib/lib/settings-undo";

export function createEditorState(args: {
  pid: string;
  projectId: () => string | undefined;
}) {
  const { pid, projectId } = args;

  const query = projectQuery(pid);
  const project = $derived(query.data);
  const slides = $derived(project?.slides ?? []);
  const title = $derived(
    project ? `OpenSlides — ${project.name}` : "OpenSlides",
  );

  let editorExpanded = $state(false);

  // Native + document window title follows the open project's name.
  $effect(() => {
    setWindowTitle(title);
  });

  // Select the persisted (or first) slide whenever the project arrives and
  // the current selection doesn't belong to it.
  $effect(() => {
    const p = project;
    if (!p) return;
    const cid = ui.currentSlideId;
    if (!cid || !p.slides.some((s) => s.id === cid)) {
      const id = p.settings.currentSlideId ?? p.slides[0]?.id ?? null;
      setCurrentSlideId(id);
    }
  });

  // Debounced currentSlide persistence.
  $effect(() => {
    const projectPid = projectId();
    const cid = ui.currentSlideId;
    if (!projectPid || !cid) return;
    const t = window.setTimeout(() => {
      api
        .setCurrentSlide(projectPid, cid)
        .catch((error) =>
          logger.debug("Failed to persist current slide", error),
        );
    }, 300);
    return () => window.clearTimeout(t);
  });

  // Clear transient preview overrides and stale setting undos on project switch.
  $effect(() => {
    void projectId();
    clearAllPreviewSettings();
    dismissAllUndoToasts();
  });

  $effect(() => () => resetEditorUi());

  return {
    query,
    get project() {
      return project;
    },
    get slides() {
      return slides;
    },
    get editorExpanded() {
      return editorExpanded;
    },
    set editorExpanded(v: boolean) {
      editorExpanded = v;
    },
  };
}
