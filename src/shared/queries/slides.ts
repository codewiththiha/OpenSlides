import { notify } from "$lib/lib/toast";
import { api, type SlideSettingsPatch } from "$lib/lib/tauri-api";
import { enqueueCodeSave } from "$lib/lib/code-save";
import {
  clearLocalCode,
  clearPreviewHighlightSetting,
  clearPreviewSlideSetting,
  setCurrentSlideId,
} from "$lib/stores/ui-state.svelte";
import { getLocalCode } from "$lib/stores/slide-code.svelte";
import { showUndoToast } from "$lib/lib/settings-undo";
import type { Project, Slide } from "$lib/types";
import { projectKeys } from "./keys";
import { queryClient } from "./query-client";
import {
  projectListMutation,
  slideMutation,
} from "./mutation-policy";

/**
 * Merge a slide returned by a settings/command response into the cached one
 * WITHOUT touching `code`. Code ownership belongs to the code channel
 * (editor localCode shadow + serialized saves); a settings response may
 * carry a stale `code` column read before the newest save landed, and
 * stamping it would briefly regress the editor value (and slam the caret
 * to the end of the textarea in WKWebView).
 */
export function mergeSlidePreservingEditorCode(
  cached: Slide,
  incoming: Slide,
): Slide {
  return {
    ...cached,
    ...incoming,
    code: cached.code,
    // Settings changes do not regenerate a thumbnail; retain an in-memory
    // render if an older backend response has no cached thumbnail yet.
    thumbnailHtml: incoming.thumbnailHtml || cached.thumbnailHtml,
  };
}

export function updateSlideCodeMutation() {
  return projectListMutation(
    ({ slideId, code }: { slideId: string; code: string }) =>
      enqueueCodeSave(slideId, code),
    {
      // Serialized per slide (see lib/code-save.ts): guarantees DB write
      // order and completion order match schedule order, so the cache stamp in
      // onSuccess below can never be an older value overwriting a newer one.
      invalidateProjectList: false,
      onSuccess: (_void, { slideId, code }) => {
        const affectsDashboardPreview = queryClient
          .getQueriesData<Project>({ queryKey: ["project"] })
          .some(([, project]) => project?.slides?.[0]?.id === slideId);

        queryClient.setQueriesData<Project>({ queryKey: ["project"] }, (old) => {
          if (!old?.slides?.some((s) => s.id === slideId)) return old;
          return {
            ...old,
            slides: old.slides.map((s) =>
              s.id === slideId ? { ...s, code, thumbnailHtml: "" } : s,
            ),
          };
        });

        const current = getLocalCode(slideId);
        if (current === undefined || current === code) {
          clearLocalCode(slideId);
        }

        if (affectsDashboardPreview) {
          void queryClient.invalidateQueries({ queryKey: projectKeys.all });
        }
      },
      onError: (err: Error) => notify.error(`Auto-save failed: ${err.message}`),
    },
  );
}

function describeSlideChange(payload: SlideSettingsPatch, before: Slide): string | null {
  if (payload.name !== undefined && payload.name !== (before.name ?? "")) return `Renamed to "${payload.name}"`;
  if (payload.duration !== undefined && payload.duration !== before.duration) return `Duration ${(before.duration / 1000).toFixed(1)}s → ${(payload.duration / 1000).toFixed(1)}s`;
  if (payload.transitionDuration !== undefined && payload.transitionDuration !== before.transitionDuration) return `Transition ${before.transitionDuration}ms → ${payload.transitionDuration}ms`;
  if (payload.stagger !== undefined && payload.stagger !== before.stagger) return `Stagger ${before.stagger} → ${payload.stagger}`;
  if (payload.highlights !== undefined) {
    const beforeCount = before.highlights?.length ?? 0;
    const afterCount = payload.highlights.length;
    if (afterCount > beforeCount) return "Highlight added";
    if (afterCount < beforeCount) return "Highlight removed";
    return "Highlight steps updated";
  }
  return null;
}

function clearCommittedSlidePreview(slideId: string, payload: SlideSettingsPatch, before?: Slide) {
  if ("duration" in payload) clearPreviewSlideSetting(slideId, "duration");
  if ("transitionDuration" in payload) clearPreviewSlideSetting(slideId, "transitionDuration");
  if ("stagger" in payload) clearPreviewSlideSetting(slideId, "stagger");
  if ("highlights" in payload) {
    const ids = new Set([
      ...(before?.highlights ?? []).map((highlight) => highlight.id),
      ...(payload.highlights ?? []).map((highlight) => highlight.id),
    ]);
    for (const id of ids) {
      clearPreviewHighlightSetting(id);
    }
  }
}

export function updateSlideSettingsMutation(projectId: string) {
  return slideMutation(
    projectId,
    ({ slideId, payload }: { slideId: string; payload: SlideSettingsPatch }) =>
      api.updateSlideSettings(slideId, payload),
    {
      onMutate: ({ slideId }) => {
        const project = queryClient.getQueryData<Project>(projectKeys.detail(projectId));
        return { before: project?.slides.find((s) => s.id === slideId) };
      },
      onSuccess: (slide: Slide, { slideId, payload }, context) => {
        queryClient.setQueryData<Project>(projectKeys.detail(projectId), (old) => {
          if (!old) return old;
          return {
            ...old,
            slides: old.slides.map((s) =>
              s.id === slide.id ? mergeSlidePreservingEditorCode(s, slide) : s,
            ),
          };
        });

        const before = context?.before;
        clearCommittedSlidePreview(slideId, payload, before);

        if (!before) return;
        const label = describeSlideChange(payload, before);
        if (!label) return;
        const revert: SlideSettingsPatch = {};
        if ("duration" in payload) revert.duration = before.duration;
        if ("transitionDuration" in payload) revert.transitionDuration = before.transitionDuration;
        if ("stagger" in payload) revert.stagger = before.stagger;
        if ("name" in payload) revert.name = before.name ?? "";
        if ("highlights" in payload) revert.highlights = before.highlights ?? [];

        showUndoToast(
          `undo-slide-${slideId}-${Object.keys(payload).sort().join("+")}`,
          label,
          () => {
            void api
              .updateSlideSettings(slideId, revert)
              .then((updated) => {
                queryClient.setQueryData<Project>(projectKeys.detail(projectId), (old) =>
                  old
                    ? {
                        ...old,
                        slides: old.slides.map((s) =>
                          s.id === updated.id ? mergeSlidePreservingEditorCode(s, updated) : s,
                        ),
                      }
                    : old,
                );
                void queryClient.invalidateQueries({ queryKey: projectKeys.all });
                notify.success("Reverted");
              })
              .catch((err: Error) => notify.error(`Revert failed: ${err.message}`));
          },
        );
      },
      onError: (err: Error) => notify.error(`Slide settings failed: ${err.message}`),
    },
  );
}

export function createSlideMutation(projectId: string) {
  return slideMutation(
    projectId,
    (opts?: { code?: string; name?: string }) => api.createSlide(projectId, opts),
    {
      invalidateProjectDetail: true,
      onError: (err: Error) => notify.error(`Could not add slide: ${err.message}`),
    },
  );
}

export function deleteSlideMutation(projectId: string) {
  return slideMutation(
    projectId,
    (slideId: string) => api.deleteSlide(projectId, slideId),
    {
      onSuccess: (project) => {
        queryClient.setQueryData(projectKeys.detail(projectId), project);
      },
      onError: (err: Error) => notify.error(`Could not delete slide: ${err.message}`),
    },
  );
}

export function duplicateSlideMutation(projectId: string) {
  return slideMutation(
    projectId,
    (slideId: string) => api.duplicateSlide(projectId, slideId),
    {
      onSuccess: (project) => {
        queryClient.setQueryData(projectKeys.detail(projectId), project);
        const newId = project.settings.currentSlideId;
        if (newId) {
          setCurrentSlideId(newId);
        }
        notify.success("Slide duplicated");
      },
      onError: (err: Error) => notify.error(`Duplicate failed: ${err.message}`),
    },
  );
}

export function restoreSlideMutation(projectId: string) {
  return slideMutation(
    projectId,
    ({ slide, insertAt }: { slide: Slide; insertAt?: number }) =>
      api.restoreSlide(projectId, slide, insertAt),
    {
      onSuccess: (project) => {
        queryClient.setQueryData(projectKeys.detail(projectId), project);
        notify.success("Slide restored");
      },
      onError: (err: Error) => notify.error(`Restore failed: ${err.message}`),
    },
  );
}

export function reorderSlidesMutation(projectId: string) {
  return slideMutation(
    projectId,
    (slideIds: string[]) => api.reorderSlides(projectId, slideIds),
    {
      onSuccess: (project) => {
        queryClient.setQueryData(projectKeys.detail(projectId), project);
      },
      onError: (err: Error) => {
        notify.error(`Reorder failed: ${err.message}`);
        void queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      },
    },
  );
}
