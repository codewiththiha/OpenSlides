import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notify } from "@/lib/toast";
import { api } from "@/lib/tauri-api";
import { projectKeys } from "./keys";
import type { Project } from "@/types";

export function useStackProjects() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceIds, targetId }: { sourceIds: string[]; targetId: string }) =>
      api.stackProjects(sourceIds, targetId),
    onSuccess: (projects) => {
      qc.setQueryData(projectKeys.all, projects);
      qc.invalidateQueries({ queryKey: projectKeys.all });
    },
    onError: (err: Error) => notify.error(`Couldn't stack presentations: ${err.message}`),
  });
}

export function useUnstackProjects() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectIds: string[]) => api.unstackProjects(projectIds),
    onSuccess: (projects) => {
      qc.setQueryData(projectKeys.all, projects);
      qc.invalidateQueries({ queryKey: projectKeys.all });
    },
    onError: (err: Error) => notify.error(`Couldn't unstack presentations: ${err.message}`),
  });
}

export function useStackSlides(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceIds, targetId }: { sourceIds: string[]; targetId: string }) =>
      api.stackSlides(projectId, sourceIds, targetId),
    onSuccess: (slides) => {
      qc.setQueryData<Project>(projectKeys.detail(projectId), (old) =>
        old ? { ...old, slides } : old
      );
      void qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
    onError: (err: Error) => notify.error(`Couldn't stack slides: ${err.message}`),
  });
}

export function useUnstackSlides(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slideIds: string[]) => api.unstackSlides(projectId, slideIds),
    onSuccess: (slides) => {
      qc.setQueryData<Project>(projectKeys.detail(projectId), (old) =>
        old ? { ...old, slides } : old
      );
      void qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
    onError: (err: Error) => notify.error(`Couldn't unstack slides: ${err.message}`),
  });
}
