import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notify } from "../../lib/toast";
import { api, type SlideSettingsPatch } from "../../lib/tauri-api";
import { enqueueCodeSave } from "../../lib/code-save";
import { useUiStore } from "../../store/useUiStore";
import { getLocalCodeAtom } from "../../store/localCodeAtoms";
import { showUndoToast } from "../../lib/settings-undo";
import type { Project, Slide } from "../../types";
import { projectKeys } from "./keys";

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

export function useUpdateSlideCode() {
  const qc = useQueryClient();
  return useMutation({
    // Serialized per slide (see lib/code-save.ts): guarantees DB write
    // order and completion order match schedule order, so the cache stamp in
    // onSuccess below can never be an older value overwriting a newer one.
    mutationFn: ({ slideId, code }: { slideId: string; code: string }) =>
      enqueueCodeSave(slideId, code),
    onSuccess: (_void, { slideId, code }) => {
      qc.setQueriesData<Project>({ queryKey: ["project"] }, (old) => {
        if (!old?.slides?.some((s) => s.id === slideId)) return old;
        return {
          ...old,
          slides: old.slides.map((s) =>
            s.id === slideId ? { ...s, code, thumbnailHtml: "" } : s,
          ),
        };
      });

      const { clearLocalCode } = useUiStore.getState();
      const current = getLocalCodeAtom(slideId);
      if (current === undefined || current === code) {
        clearLocalCode(slideId);
      }
      // The dashboard card can show this slide as its first-slide preview.
      void qc.invalidateQueries({ queryKey: projectKeys.all });
    },
    onError: (err: Error) => notify.error(`Auto-save failed: ${err.message}`),
  });
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

export function useUpdateSlideSettings(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slideId, payload }: { slideId: string; payload: SlideSettingsPatch }) =>
      api.updateSlideSettings(slideId, payload),
    onMutate: ({ slideId }) => {
      const project = qc.getQueryData<Project>(projectKeys.detail(projectId));
      return { before: project?.slides.find((s) => s.id === slideId) };
    },
    onSuccess: (slide: Slide, { slideId, payload }, context) => {
      qc.setQueryData<Project>(projectKeys.detail(projectId), (old) => {
        if (!old) return old;
        return {
          ...old,
          slides: old.slides.map((s) =>
            s.id === slide.id ? mergeSlidePreservingEditorCode(s, slide) : s,
          ),
        };
      });

      // Names, ordering-related settings, and rendered summaries can appear
      // on dashboard cards, so refresh the project list on a later visit.
      void qc.invalidateQueries({ queryKey: projectKeys.all });

      const before = context?.before;
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
          void api.updateSlideSettings(slideId, revert)
            .then((updated) => {
              qc.setQueryData<Project>(projectKeys.detail(projectId), (old) =>
                old
                  ? {
                      ...old,
                      slides: old.slides.map((s) =>
                        s.id === updated.id ? mergeSlidePreservingEditorCode(s, updated) : s,
                      ),
                    }
                  : old,
              );
              notify.success("Reverted");
            })
            .catch((err: Error) => notify.error(`Revert failed: ${err.message}`));
        },
      );
    },
    onError: (err: Error) => notify.error(`Slide settings failed: ${err.message}`),
  });
}

export function useCreateSlide(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts?: { code?: string; name?: string }) =>
      api.createSlide(projectId, opts),
    onSuccess: async (slide) => {
      // All creation paths (toolbar, native menu, command palette, and the
      // slide rail) should land on the newly created slide immediately.
      useUiStore.getState().setCurrentSlideId(slide.id);
      await qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      await qc.invalidateQueries({ queryKey: projectKeys.all });
    },
    onError: (err: Error) =>
      notify.error(`Could not add slide: ${err.message}`),
  });
}

export function useDeleteSlide(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slideId: string) => api.deleteSlide(projectId, slideId),
    onSuccess: (project) => {
      qc.setQueryData(projectKeys.detail(projectId), project);
      void qc.invalidateQueries({ queryKey: projectKeys.all });
    },
    onError: (err: Error) =>
      notify.error(`Could not delete slide: ${err.message}`),
  });
}

export function useDuplicateSlide(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slideId: string) => api.duplicateSlide(projectId, slideId),
    onSuccess: (project) => {
      qc.setQueryData(projectKeys.detail(projectId), project);
      void qc.invalidateQueries({ queryKey: projectKeys.all });
      // Set current to duplicated slide (last currentSlideId from backend)
      const newId = project.settings.currentSlideId;
      if (newId) {
        useUiStore.getState().setCurrentSlideId(newId);
      }
      notify.success("Slide duplicated");
    },
    onError: (err: Error) =>
      notify.error(`Duplicate failed: ${err.message}`),
  });
}

export function useRestoreSlide(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slide, insertAt }: { slide: Slide; insertAt?: number }) =>
      api.restoreSlide(projectId, slide, insertAt),
    onSuccess: (project) => {
      qc.setQueryData(projectKeys.detail(projectId), project);
      void qc.invalidateQueries({ queryKey: projectKeys.all });
      notify.success("Slide restored");
    },
    onError: (err: Error) => notify.error(`Restore failed: ${err.message}`),
  });
}

export function useReorderSlides(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slideIds: string[]) => api.reorderSlides(projectId, slideIds),
    onSuccess: (project) => {
      qc.setQueryData(projectKeys.detail(projectId), project);
      // Reordering can change the first slide used by the dashboard card.
      void qc.invalidateQueries({ queryKey: projectKeys.all });
    },
    onError: (err: Error) => {
      notify.error(`Reorder failed: ${err.message}`);
      void qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
}
