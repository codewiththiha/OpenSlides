import { MutationCache, QueryClient } from "@tanstack/react-query";
import { projectKeys } from "./keys";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      /** Any mutation that can affect dashboard cards opts into one policy here. */
      invalidateProjectList?: boolean;
    };
  }
}

/**
 * App-wide React Query client.
 *
 * Cross-cutting mutation side effects live here instead of being repeated in
 * every command hook. If the dashboard ever misses an update, fix this policy
 * or the mutation metadata rather than hunting for ad-hoc invalidations.
 */
export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: async (_data, _variables, _context, mutation) => {
      if (mutation.meta?.invalidateProjectList) {
        await queryClient.invalidateQueries({ queryKey: projectKeys.all });
      }
    },
  }),
  defaultOptions: {
    queries: {
      // Local SQLite is the single source of truth and Tauri is the only writer,
      // so we have absolute cache consistency. No need for background refetches.
      staleTime: Infinity,
      gcTime: 1000 * 60 * 30, // 30 minutes in memory
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
    },
  },
});
