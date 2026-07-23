/**
 * Slide-strip rename state — wraps the generic rename controller with the
 * slide-settings mutation (persist → optimistic local rename on success).
 */
import { createRenameState } from "$lib/lib/rename-state.svelte";
import type { Slide } from "$lib/types";

interface SettingsMutationLike {
  mutate: (
    vars: { slideId: string; payload: { name: string } },
    opts?: { onSuccess?: () => void; onError?: () => void },
  ) => void;
}

export function createSlideStripRename(args: {
  updateSettings: SettingsMutationLike;
  ordered: () => Slide[];
  setOrdered: (slides: Slide[]) => void;
}) {
  return createRenameState(async (id: string, name: string) => {
    const finalName = name || "Untitled slide";
    await new Promise<void>((resolve) => {
      args.updateSettings.mutate(
        { slideId: id, payload: { name: finalName } },
        {
          onSuccess: () => {
            args.setOrdered(
              args
                .ordered()
                .map((s) => (s.id === id ? { ...s, name: finalName } : s)),
            );
            resolve();
          },
          onError: () => resolve(),
        },
      );
    });
  });
}
