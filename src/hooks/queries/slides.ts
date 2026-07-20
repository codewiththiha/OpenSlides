import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notify } from "../../lib/toast";
import { api, type SlideSettingsPatch } from "../../lib/tauri-api";
import { enqueueCodeSave } from "../../lib/code-save";
import { useUiStore } from "../../store/useUiStore";
import { getLocalCodeAtom } from "../../store/localCodeAtoms";
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
  return { ...cached, ...incoming, code: cached.code };
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
    },
    onError: (err: Error) => notify.error(`Auto-save failed: ${err.message}`),
  });
}

export function useUpdateSlideSettings(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      slideId,
      payload,
    }: {
      slideId: string;
      payload: SlideSettingsPatch;
    }) => api.updateSlideSettings(slideId, payload),
    onSuccess: (slide: Slide) => {
      qc.setQueryData<Project>(projectKeys.detail(projectId), (old) => {
        if (!old) return old;
        return {
          ...old,
          slides: old.slides.map((s) =>
            s.id === slide.id ? mergeSlidePreservingEditorCode(s, slide) : s,
          ),
        };
      });
    },
    onError: (err: Error) =>
      notify.error(`Slide settings failed: ${err.message}`),
  });
}

export function useCreateSlide(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts?: { code?: string; name?: string }) =>
      api.createSlide(projectId, opts),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      notify.success("Slide added");
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
    },
    onError: (err: Error) => {
      notify.error(`Reorder failed: ${err.message}`);
      void qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
}
