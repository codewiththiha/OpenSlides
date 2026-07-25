import { notify } from "$lib/lib/toast";
import { api } from "$lib/lib/tauri-api";
import { projectKeys } from "./keys";
import { queryClient } from "./query-client";
import type { Project, Slide } from "$lib/types";
import { projectListMutation, slideMutation } from "./mutation-policy";

export function stackProjectsMutation() {
  return projectListMutation(
    ({ sourceIds, targetId }: { sourceIds: string[]; targetId: string }) =>
      api.stackProjects(sourceIds, targetId),
    {
      onSuccess: (projects) => {
        queryClient.setQueryData(projectKeys.all, projects);
      },
      onError: (err: Error) =>
        notify.error(`Couldn't stack presentations: ${err.message}`),
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
      onError: (err: Error) =>
        notify.error(`Couldn't unstack presentations: ${err.message}`),
    },
  );
}

function slideStackMutation<V>(
  projectId: string,
  mutationFn: (variables: V) => Promise<Slide[]>,
  label: string,
) {
  return slideMutation(projectId, mutationFn, {
    invalidateProjectDetail: true,
    onSuccess: (slides) => {
      queryClient.setQueryData<Project>(projectKeys.detail(projectId), (old) =>
        old ? { ...old, slides } : old,
      );
    },
    onError: (err: Error) => notify.error(`Couldn't ${label}: ${err.message}`),
  });
}

export function stackSlidesMutation(projectId: string) {
  return slideStackMutation(
    projectId,
    ({ sourceIds, targetId }: { sourceIds: string[]; targetId: string }) =>
      api.stackSlides(projectId, sourceIds, targetId),
    "stack slides",
  );
}

export function unstackSlidesMutation(projectId: string) {
  return slideStackMutation(
    projectId,
    (slideIds: string[]) => api.unstackSlides(projectId, slideIds),
    "unstack slides",
  );
}
