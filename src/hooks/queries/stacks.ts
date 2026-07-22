import { useQueryClient } from "@tanstack/react-query";
import { notify } from "@/lib/toast";
import { api } from "@/lib/tauri-api";
import { projectKeys } from "./keys";
import type { Project } from "@/types";
import { useProjectListInvalidatingMutation, useSlideMutation } from "./useProjectMutation";

export function useStackProjects() {
  const qc = useQueryClient();
  return useProjectListInvalidatingMutation(
    ({ sourceIds, targetId }: { sourceIds: string[]; targetId: string }) =>
      api.stackProjects(sourceIds, targetId),
    {
      onSuccess: (projects) => {
        qc.setQueryData(projectKeys.all, projects);
      },
      onError: (err: Error) => notify.error(`Couldn't stack presentations: ${err.message}`),
    },
  );
}

export function useUnstackProjects() {
  const qc = useQueryClient();
  return useProjectListInvalidatingMutation(
    (projectIds: string[]) => api.unstackProjects(projectIds),
    {
      onSuccess: (projects) => {
        qc.setQueryData(projectKeys.all, projects);
      },
      onError: (err: Error) => notify.error(`Couldn't unstack presentations: ${err.message}`),
    },
  );
}

export function useStackSlides(projectId: string) {
  const qc = useQueryClient();
  return useSlideMutation(
    projectId,
    ({ sourceIds, targetId }: { sourceIds: string[]; targetId: string }) =>
      api.stackSlides(projectId, sourceIds, targetId),
    {
      invalidateProjectDetail: true,
      invalidateProjectList: false,
      onSuccess: (slides) => {
        qc.setQueryData<Project>(projectKeys.detail(projectId), (old) =>
          old ? { ...old, slides } : old,
        );
      },
      onError: (err: Error) => notify.error(`Couldn't stack slides: ${err.message}`),
    },
  );
}

export function useUnstackSlides(projectId: string) {
  const qc = useQueryClient();
  return useSlideMutation(
    projectId,
    (slideIds: string[]) => api.unstackSlides(projectId, slideIds),
    {
      invalidateProjectDetail: true,
      invalidateProjectList: false,
      onSuccess: (slides) => {
        qc.setQueryData<Project>(projectKeys.detail(projectId), (old) =>
          old ? { ...old, slides } : old,
        );
      },
      onError: (err: Error) => notify.error(`Couldn't unstack slides: ${err.message}`),
    },
  );
}
