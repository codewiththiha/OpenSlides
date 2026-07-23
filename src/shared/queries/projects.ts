import { createMutation, createQuery } from "@tanstack/svelte-query";
import { notify } from "$lib/lib/toast";
import { api, isCancelledError, type SettingsPatch } from "$lib/lib/tauri-api";
import { projectKeys } from "./keys";
import { queryClient } from "./query-client";
import { projectListMutation } from "./mutation-policy";
import { showUndoToast } from "$lib/lib/settings-undo";
import { clearPreviewProjectSetting } from "$lib/stores/ui-state.svelte";
import type { PreviewProjectSettings } from "$lib/stores/types";
import type { Project, ProjectSettings, ThemeName } from "$lib/types";

export function projectsQuery() {
  return createQuery(
    () => ({
      queryKey: projectKeys.all,
      queryFn: api.getProjects,
      // The app-wide client intentionally keeps queries fresh indefinitely.
      // Dashboard summaries can change while editing a project, so always verify
      // the list whenever the dashboard mounts as a safety net.
      refetchOnMount: "always",
    }),
    () => queryClient,
  );
}

export function projectQuery(projectId: string | undefined) {
  return createQuery(
    () => ({
      queryKey: projectKeys.detail(projectId ?? ""),
      queryFn: () => api.getProject(projectId!),
      enabled: Boolean(projectId),
    }),
    () => queryClient,
  );
}

export function createProjectMutation() {
  return projectListMutation((name: string) => api.createProject(name), {
    onSuccess: () => notify.success("Presentation created"),
    onError: (err: Error) =>
      notify.error(`Couldn't create presentation: ${err.message}`),
  });
}

export function duplicateProjectMutation() {
  return projectListMutation((id: string) => api.duplicateProject(id), {
    onSuccess: () => notify.success("Presentation duplicated"),
    onError: (err: Error) => notify.error(`Couldn't duplicate: ${err.message}`),
  });
}

export function deleteProjectMutation() {
  return projectListMutation((id: string) => api.deleteProject(id), {
    onSuccess: () => notify.success("Presentation deleted"),
    onError: (err: Error) => notify.error(`Couldn't delete: ${err.message}`),
  });
}

export function renameProjectMutation() {
  return projectListMutation(
    ({ projectId, name }: { projectId: string; name: string }) =>
      api.renameProject(projectId, name),
    {
      onSuccess: (project) => {
        queryClient.setQueryData(projectKeys.detail(project.id), project);
        notify.success("Presentation renamed");
      },
      onError: (err: Error) => notify.error(`Rename failed: ${err.message}`),
    },
  );
}

const previewProjectSettingKeys = new Set<string>([
  "fontSize",
  "lineHeight",
  "editorFontSize",
  "globalTransitionDuration",
  "globalStagger",
  "useBlackCodeBackground",
]);

function isPreviewProjectSettingKey(
  key: keyof ProjectSettings,
): key is Extract<keyof ProjectSettings, keyof PreviewProjectSettings> {
  return previewProjectSettingKeys.has(key);
}

function describeProjectChange(
  patch: SettingsPatch,
  before: ProjectSettings,
): string | null {
  if (patch.fontSize !== undefined && patch.fontSize !== before.fontSize) return `Preview font ${before.fontSize}px → ${patch.fontSize}px`;
  if (patch.lineHeight !== undefined && patch.lineHeight !== before.lineHeight) return `Line height ${before.lineHeight.toFixed(2)} → ${patch.lineHeight.toFixed(2)}`;
  if (patch.editorFontSize !== undefined && patch.editorFontSize !== before.editorFontSize) return `Editor font ${before.editorFontSize}px → ${patch.editorFontSize}px`;
  if (patch.globalTransitionDuration !== undefined && patch.globalTransitionDuration !== before.globalTransitionDuration) return `Global transition ${before.globalTransitionDuration}ms → ${patch.globalTransitionDuration}ms`;
  if (patch.globalStagger !== undefined && patch.globalStagger !== before.globalStagger) return `Global stagger ${before.globalStagger} → ${patch.globalStagger}`;
  if (patch.codeAlign !== undefined && patch.codeAlign !== before.codeAlign) return `Code layout → ${patch.codeAlign}`;
  if (patch.showLineNumbers !== undefined && patch.showLineNumbers !== before.showLineNumbers) return patch.showLineNumbers ? "Preview line numbers on" : "Preview line numbers off";
  if (patch.language !== undefined && patch.language !== before.language) return `Language → ${patch.language}`;
  if (patch.useGlobalTransition !== undefined && patch.useGlobalTransition !== before.useGlobalTransition) return patch.useGlobalTransition ? "Global transition enabled" : "Global transition disabled";
  if (patch.useGlobalStagger !== undefined && patch.useGlobalStagger !== before.useGlobalStagger) return patch.useGlobalStagger ? "Global stagger enabled" : "Global stagger disabled";
  return null;
}

export function updateProjectSettingsMutation(projectId: string) {
  return projectListMutation<Project, SettingsPatch, { before?: ProjectSettings }>(
    (settings) => api.updateProjectSettings(projectId, settings),
    {
      onMutate: () => {
        const project = queryClient.getQueryData<Project>(projectKeys.detail(projectId));
        return { before: project?.settings };
      },
      onSuccess: (project, patch, context) => {
        queryClient.setQueryData(projectKeys.detail(projectId), project);
        for (const key of Object.keys(patch) as (keyof SettingsPatch)[]) {
          if (isPreviewProjectSettingKey(key)) {
            clearPreviewProjectSetting(key);
          }
        }
        const before = context?.before;
        if (!before) return;
        const label = describeProjectChange(patch, before);
        if (!label) return;
        const revert: SettingsPatch = {};
        for (const key of Object.keys(patch) as (keyof SettingsPatch)[]) {
          (revert as Record<string, unknown>)[key] = before[key];
        }
        showUndoToast(
          `undo-project-${projectId}-${Object.keys(patch).sort().join("+")}`,
          label,
          () => {
            void api
              .updateProjectSettings(projectId, revert)
              .then((updated) => {
                queryClient.setQueryData(projectKeys.detail(projectId), updated);
                void queryClient.invalidateQueries({ queryKey: projectKeys.all });
                notify.success("Reverted");
              })
              .catch((err: Error) => notify.error(`Revert failed: ${err.message}`));
          },
        );
      },
      onError: (err: Error) => notify.error(`Settings save failed: ${err.message}`),
    },
  );
}

export function updateProjectThemeMutation(projectId: string) {
  return projectListMutation(
    (theme: ThemeName) => api.updateProjectTheme(projectId, theme),
    {
      onSuccess: (project) => {
        queryClient.setQueryData(projectKeys.detail(projectId), project);
      },
      onError: (err: Error) => notify.error(`Theme update failed: ${err.message}`),
    },
  );
}

export function exportProjectMutation() {
  return createMutation(
    () => ({
      mutationFn: (projectId: string) => api.exportProjectToJson(projectId),
      onSuccess: (path) => notify.success(`Exported to ${path}`),
      onError: (err: Error) => {
        // User closed the save dialog — not a failure.
        if (!isCancelledError(err)) {
          notify.error(`Export failed: ${err.message}`);
        }
      },
    }),
    () => queryClient,
  );
}

export function importProjectMutation() {
  return projectListMutation<Project, void>(
    () => api.importProjectFromJson(),
    {
      onSuccess: () => {
        notify.success("Presentation imported");
      },
      onError: (err: Error) => {
        // User closed the open dialog — not a failure.
        if (!isCancelledError(err)) {
          notify.error(`Import failed: ${err.message}`);
        }
      },
    },
  );
}
