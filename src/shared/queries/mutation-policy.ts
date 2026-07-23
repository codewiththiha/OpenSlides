import {
  createMutation,
  type CreateMutationOptions,
} from "@tanstack/svelte-query";
import { queryClient } from "./query-client";
import { projectKeys } from "./keys";

interface ProjectListInvalidatingMutationOptions<TData, TVariables, TContext>
  extends Omit<CreateMutationOptions<TData, Error, TVariables, TContext>, "mutationFn"> {
  /** Set false only for mutations that cannot affect dashboard summaries. */
  invalidateProjectList?: boolean;
}

type ProjectMutationOptions<TData, TVariables, TContext> =
  ProjectListInvalidatingMutationOptions<TData, TVariables, TContext>;

interface SlideMutationOptions<TData, TVariables, TContext>
  extends ProjectListInvalidatingMutationOptions<TData, TVariables, TContext> {
  /** Refetch the active project detail after local cache updates/onSuccess run. */
  invalidateProjectDetail?: boolean;
}

/**
 * Lowest-level mutation policy: dashboard-list invalidation is handled by the
 * global MutationCache from metadata, not by copy-pasted onSuccess blocks.
 *
 * The singleton queryClient is passed explicitly so these factories work from
 * any component without needing a QueryClientProvider ancestor.
 */
export function projectListMutation<TData, TVariables, TContext = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: ProjectListInvalidatingMutationOptions<TData, TVariables, TContext> = {},
) {
  const { invalidateProjectList = true, meta, ...mutationOptions } = options;

  return createMutation<TData, Error, TVariables, TContext>(
    () => ({
      ...mutationOptions,
      mutationFn,
      meta: {
        ...meta,
        invalidateProjectList,
      },
    }),
    () => queryClient,
  );
}

/**
 * Shared mutation policy for project-affecting commands.
 *
 * The app keeps query data fresh indefinitely, so mutations that can alter a
 * dashboard card opt into app-wide project-list invalidation by default.
 */
export function projectMutation<TData, TVariables, TContext = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: ProjectMutationOptions<TData, TVariables, TContext> = {},
) {
  return projectListMutation(mutationFn, options);
}

/**
 * Shared mutation policy for slide-affecting commands.
 *
 * Individual hooks still decide how to update the open project cache, but they
 * no longer need to remember dashboard invalidation or optional detail refetch.
 */
export function slideMutation<TData, TVariables, TContext = unknown>(
  projectId: string,
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: SlideMutationOptions<TData, TVariables, TContext> = {},
) {
  const {
    onSuccess,
    invalidateProjectDetail = false,
    ...mutationOptions
  } = options;

  return projectListMutation<TData, TVariables, TContext>(mutationFn, {
    ...mutationOptions,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await onSuccess?.(data, variables, onMutateResult, context);
      if (invalidateProjectDetail) {
        await queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      }
    },
  });
}
