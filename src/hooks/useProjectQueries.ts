import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type SettingsPatch, type SlideSettingsPatch } from "../lib/tauri-api";
import type { Project, Slide } from "../types";

export const projectKeys = {
  all: ["projects"] as const,
  detail: (id: string) => ["project", id] as const,
};

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
      toast.success("Project created");
    },
    onError: (err: Error) => toast.error(`Failed to create project: ${err.message}`),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.all });
      toast.success("Project deleted");
    },
    onError: (err: Error) => toast.error(`Failed to delete: ${err.message}`),
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
      toast.success("Project renamed");
    },
    onError: (err: Error) => toast.error(`Rename failed: ${err.message}`),
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
    onError: (err: Error) => toast.error(`Settings save failed: ${err.message}`),
  });
}

export function useUpdateTheme(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (theme: string) => api.updateProjectTheme(projectId, theme),
    onSuccess: (project) => {
      qc.setQueryData(projectKeys.detail(projectId), project);
    },
    onError: (err: Error) => toast.error(`Theme update failed: ${err.message}`),
  });
}

export function useUpdateSlideCode() {
  return useMutation({
    mutationFn: ({ slideId, code }: { slideId: string; code: string }) =>
      api.updateSlideCode(slideId, code),
    onError: (err: Error) => toast.error(`Auto-save failed: ${err.message}`),
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
          slides: old.slides.map((s) => (s.id === slide.id ? { ...s, ...slide } : s)),
        };
      });
    },
    onError: (err: Error) => toast.error(`Slide settings failed: ${err.message}`),
  });
}

export function useCreateSlide(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts?: { code?: string }) => api.createSlide(projectId, opts),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      toast.success("Slide added");
    },
    onError: (err: Error) => toast.error(`Could not add slide: ${err.message}`),
  });
}

export function useDeleteSlide(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slideId: string) => api.deleteSlide(projectId, slideId),
    onSuccess: (project) => {
      qc.setQueryData(projectKeys.detail(projectId), project);
    },
    onError: (err: Error) => toast.error(`Could not delete slide: ${err.message}`),
  });
}

export function useRestoreSlide(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slide, insertAt }: { slide: Slide; insertAt?: number }) =>
      api.restoreSlide(projectId, slide, insertAt),
    onSuccess: (project) => {
      qc.setQueryData(projectKeys.detail(projectId), project);
      toast.success("Slide restored");
    },
    onError: (err: Error) => toast.error(`Restore failed: ${err.message}`),
  });
}

export function useReorderSlides(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slideIds: string[]) => api.reorderSlides(projectId, slideIds),
    onSuccess: (project) => {
      qc.setQueryData(projectKeys.detail(projectId), project);
    },
    onError: (err: Error) => toast.error(`Reorder failed: ${err.message}`),
  });
}

export function useExportProject() {
  return useMutation({
    mutationFn: (projectId: string) => api.exportProjectToJson(projectId),
    onSuccess: (path) => toast.success(`Exported to ${path}`),
    onError: (err: Error) => {
      if (err.message !== "Export cancelled") {
        toast.error(`Export failed: ${err.message}`);
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
      toast.success("Project imported");
    },
    onError: (err: Error) => {
      if (err.message !== "Import cancelled") {
        toast.error(`Import failed: ${err.message}`);
      }
    },
  });
}
