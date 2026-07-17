import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { notify } from "../../lib/toast";
import { api, type SettingsPatch } from "../../lib/tauri-api";
import { projectKeys } from "./keys";

export function useProjects() {
  return useQuery({
    queryKey: projectKeys.all,
    queryFn: api.getProjects,
  });
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(projectId ?? ""),
    queryFn: () => api.getProject(projectId!),
    enabled: Boolean(projectId),
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
      if (err.message !== "Export cancelled") {
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
      if (err.message !== "Import cancelled") {
        notify.error(`Import failed: ${err.message}`);
      }
    },
  });
}
