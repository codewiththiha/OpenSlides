import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { projectKeys } from "./keys";

interface ProjectListInvalidatingMutationOptions<TData, TVariables, TContext>
  extends Omit<UseMutationOptions<TData, Error, TVariables, TContext>, "mutationFn"> {
  /** Set false only for mutations that cannot affect dashboard summaries. */
  invalidateProjectList?: boolean;
}

interface ProjectMutationOptions<TData, TVariables, TContext>
  extends ProjectListInvalidatingMutationOptions<TData, TVariables, TContext> {}

interface SlideMutationOptions<TData, TVariables, TContext>
  extends ProjectListInvalidatingMutationOptions<TData, TVariables, TContext> {
  /** Refetch the active project detail after local cache updates/onSuccess run. */
  invalidateProjectDetail?: boolean;
}

/**
 * Lowest-level mutation policy: dashboard-list invalidation is handled by the
 * global MutationCache from metadata, not by copy-pasted onSuccess blocks.
 */
export function useProjectListInvalidatingMutation<TData, TVariables, TContext = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: ProjectListInvalidatingMutationOptions<TData, TVariables, TContext> = {},
) {
  const { invalidateProjectList = true, meta, ...mutationOptions } = options;

  return useMutation({
    ...mutationOptions,
    mutationFn,
    meta: {
      ...meta,
      invalidateProjectList,
    },
  });
}

/**
 * Shared mutation policy for project-affecting commands.
 *
 * The app keeps query data fresh indefinitely, so mutations that can alter a
 * dashboard card opt into app-wide project-list invalidation by default.
 */
export function useProjectMutation<TData, TVariables, TContext = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: ProjectMutationOptions<TData, TVariables, TContext> = {},
) {
  return useProjectListInvalidatingMutation(mutationFn, options);
}

/**
 * Shared mutation policy for slide-affecting commands.
 *
 * Individual hooks still decide how to update the open project cache, but they
 * no longer need to remember dashboard invalidation or optional detail refetch.
 */
export function useSlideMutation<TData, TVariables, TContext = unknown>(
  projectId: string,
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: SlideMutationOptions<TData, TVariables, TContext> = {},
) {
  const qc = useQueryClient();
  const {
    onSuccess,
    invalidateProjectDetail = false,
    ...mutationOptions
  } = options;

  return useProjectListInvalidatingMutation(mutationFn, {
    ...mutationOptions,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await onSuccess?.(data, variables, onMutateResult, context);
      if (invalidateProjectDetail) {
        await qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      }
    },
  });
}
