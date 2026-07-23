import { notify } from "$lib/lib/toast";
import { api } from "$lib/lib/tauri-api";
import { projectKeys } from "./keys";
import { queryClient } from "./query-client";
import type { Project } from "$lib/types";
import {
  projectListMutation,
  slideMutation,
} from "./mutation-policy";

export function stackProjectsMutation() {
  return projectListMutation(
    ({ sourceIds, targetId }: { sourceIds: string[]; targetId: string }) =>
      api.stackProjects(sourceIds, targetId),
    {
      onSuccess: (projects) => {
        queryClient.setQueryData(projectKeys.all, projects);
      },
      onError: (err: Error) => notify.error(`Couldn't stack presentations: ${err.message}`),
    },
  );
}

export function unstackProjectsMutation() {
  return projectListMutation(
    (projectIds: string[]) => api.unstackProjects(projectIds),
    {
      onSuccess: (projects) => {
        queryClient.setQueryData(projectKeys.all, projects);
      },
      onError: (err: Error) => notify.error(`Couldn't unstack presentations: ${err.message}`),
    },
  );
}

export function stackSlidesMutation(projectId: string) {
  return slideMutation(
    projectId,
    ({ sourceIds, targetId }: { sourceIds: string[]; targetId: string }) =>
      api.stackSlides(projectId, sourceIds, targetId),
    {
      invalidateProjectDetail: true,
      onSuccess: (slides) => {
        queryClient.setQueryData<Project>(projectKeys.detail(projectId), (old) =>
          old ? { ...old, slides } : old,
        );
      },
      onError: (err: Error) => notify.error(`Couldn't stack slides: ${err.message}`),
    },
  );
}

export function unstackSlidesMutation(projectId: string) {
  return slideMutation(
    projectId,
    (slideIds: string[]) => api.unstackSlides(projectId, slideIds),
    {
      invalidateProjectDetail: true,
      onSuccess: (slides) => {
        queryClient.setQueryData<Project>(projectKeys.detail(projectId), (old) =>
          old ? { ...old, slides } : old,
        );
      },
      onError: (err: Error) => notify.error(`Couldn't unstack slides: ${err.message}`),
    },
  );
}
