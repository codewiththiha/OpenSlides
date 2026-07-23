import { untrack } from "svelte";
import { findSingleMemberGroups } from "$lib/lib/stacking";

/**
 * Auto-dissolves any stack (group or slide section) that has <= 1 member remaining.
 * Effect only tracks `items` — the callbacks are read untracked so identity
 * changes don't retrigger dissolution.
 */
export function autoDissolveStacks<T>(
  items: () => T[],
  getGroupId: (i: T) => string | null | undefined,
  getId: (i: T) => string,
  unstack: (ids: string[]) => void,
): void {
  $effect(() => {
    const singleGroups = findSingleMemberGroups(items(), getGroupId, getId);
    untrack(() => {
      for (const ids of singleGroups) {
        unstack(ids);
      }
    });
  });
}
