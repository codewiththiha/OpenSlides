import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { projectKeys } from "./keys";

interface ProjectMutationOptions<TData, TVariables, TContext>
  extends Omit<UseMutationOptions<TData, Error, TVariables, TContext>, "mutationFn" | "onSuccess"> {
  onSuccess?: UseMutationOptions<TData, Error, TVariables, TContext>["onSuccess"];
  /** Set false only for mutations that cannot affect dashboard summaries. */
  invalidateProjectList?: boolean;
}

/**
 * Shared mutation policy for project-affecting commands.
 *
 * The app keeps query data fresh indefinitely, so every mutation that can
 * alter a dashboard card invalidates the project-list query by default.
 */
export function useProjectMutation<TData, TVariables, TContext = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: ProjectMutationOptions<TData, TVariables, TContext> = {},
) {
  const qc = useQueryClient();
  const {
    onSuccess,
    invalidateProjectList = true,
    ...mutationOptions
  } = options;

  return useMutation({
    ...mutationOptions,
    mutationFn,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await onSuccess?.(data, variables, onMutateResult, context);
      if (invalidateProjectList) {
        await qc.invalidateQueries({ queryKey: projectKeys.all });
      }
    },
  });
}
