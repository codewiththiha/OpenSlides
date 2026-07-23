/**
 * Stack-spread (fan overlay) open state for the project grid: which chunk
 * is expanded, kept in sync with the live project list, plus the
 * auto-close rule when a stack shrinks to nearly nothing.
 */
import type { GroupChunk } from "$lib/lib/grouping";
import type { ProjectSummary } from "$lib/types";

export function createStackSpreadState(args: {
  chunks: () => GroupChunk<ProjectSummary>[];
}) {
  let expandedChunkInfo = $state<{
    chunk: GroupChunk<ProjectSummary>;
    el: HTMLElement | null;
  } | null>(null);

  // Keep the expanded chunk synchronized with the latest project data.
  const currentExpandedChunk = $derived.by(() => {
    const info = expandedChunkInfo;
    if (!info) return null;
    const latest = args.chunks().find(
      (c) =>
        (c.groupId && c.groupId === info.chunk.groupId) ||
        (!c.groupId && c.items[0]?.id === info.chunk.items[0]?.id),
    );
    if (!latest || latest.items.length <= 1) return null;
    return latest;
  });

  function closeIfNearlyEmpty() {
    if (currentExpandedChunk && currentExpandedChunk.items.length <= 2) {
      expandedChunkInfo = null;
    }
  }

  return {
    get expandedChunkInfo() {
      return expandedChunkInfo;
    },
    set expandedChunkInfo(next: { chunk: GroupChunk<ProjectSummary>; el: HTMLElement | null } | null) {
      expandedChunkInfo = next;
    },
    get currentExpandedChunk() {
      return currentExpandedChunk;
    },
    closeIfNearlyEmpty,
    open(chunk: GroupChunk<ProjectSummary>, el: HTMLElement | null) {
      expandedChunkInfo = { chunk, el };
    },
    close() {
      expandedChunkInfo = null;
    },
  };
}
