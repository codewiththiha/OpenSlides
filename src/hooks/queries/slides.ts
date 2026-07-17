import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { notify } from "../../lib/toast";
import { api, type SlideSettingsPatch } from "../../lib/tauri-api";
import { useUiStore } from "../../store/useUiStore";
import type { Project, Slide } from "../../types";
import { projectKeys } from "./keys";

export function useUpdateSlideCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slideId, code }: { slideId: string; code: string }) =>
      api.updateSlideCode(slideId, code),
    onSuccess: (_void, { slideId, code }) => {
      qc.setQueriesData<Project>({ queryKey: ["project"] }, (old) => {
        if (!old?.slides?.some((s) => s.id === slideId)) return old;
        return {
          ...old,
          slides: old.slides.map((s) =>
            s.id === slideId ? { ...s, code } : s,
          ),
        };
      });

      const { localCode, clearLocalCode } = useUiStore.getState();
      if (localCode[slideId] === undefined || localCode[slideId] === code) {
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
            s.id === slide.id ? { ...s, ...slide } : s,
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
