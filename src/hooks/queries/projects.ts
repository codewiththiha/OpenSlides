import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { notify } from "../../lib/toast";
import { api, isCancelledError, type SettingsPatch } from "../../lib/tauri-api";
import { projectKeys } from "./keys";

export function useProjects() {
  return useQuery({
    queryKey: projectKeys.all,
    queryFn: api.getProjects,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 30,
  });
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(projectId ?? ""),
    queryFn: () => api.getProject(projectId!),
    enabled: Boolean(projectId),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 30,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.createProject(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.all });
      notify.success("Project created");
    },
    onError: (err: Error) =>
      notify.error(`Failed to create project: ${err.message}`),
  });
}

export function useDuplicateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.duplicateProject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.all });
      notify.success("Project duplicated");
    },
    onError: (err: Error) => notify.error(`Failed to duplicate: ${err.message}`),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.all });
      notify.success("Project deleted");
    },
    onError: (err: Error) => notify.error(`Failed to delete: ${err.message}`),
  });
}

export function useRenameProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, name }: { projectId: string; name: string }) =>
      api.renameProject(projectId, name),
    onSuccess: (project) => {
      qc.setQueryData(projectKeys.detail(project.id), project);
      qc.invalidateQueries({ queryKey: projectKeys.all });
      notify.success("Project renamed");
    },
    onError: (err: Error) => notify.error(`Rename failed: ${err.message}`),
  });
}

export function useUpdateSettings(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: SettingsPatch) =>
      api.updateProjectSettings(projectId, settings),
    onSuccess: (project) => {
      qc.setQueryData(projectKeys.detail(projectId), project);
      qc.invalidateQueries({ queryKey: projectKeys.all });
    },
    onError: (err: Error) =>
      notify.error(`Settings save failed: ${err.message}`),
  });
}

export function useUpdateTheme(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (theme: string) => api.updateProjectTheme(projectId, theme),
    onSuccess: (project) => {
      qc.setQueryData(projectKeys.detail(projectId), project);
    },
    onError: (err: Error) =>
      notify.error(`Theme update failed: ${err.message}`),
  });
}

export function useExportProject() {
  return useMutation({
    mutationFn: (projectId: string) => api.exportProjectToJson(projectId),
    onSuccess: (path) => notify.success(`Exported to ${path}`),
    onError: (err: Error) => {
      // User closed the save dialog — not a failure.
      if (!isCancelledError(err)) {
        notify.error(`Export failed: ${err.message}`);
      }
    },
  });
}

export function useImportProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.importProjectFromJson(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.all });
      notify.success("Project imported");
    },
    onError: (err: Error) => {
      // User closed the open dialog — not a failure.
      if (!isCancelledError(err)) {
        notify.error(`Import failed: ${err.message}`);
      }
    },
  });
}
