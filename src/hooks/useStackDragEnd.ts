import { useCallback } from "react";
import type { Active, Over } from "@dnd-kit/core";

export interface UseStackDragEndOpts {
  stackTargetKind: string;
  resolveSourceIds: (activeData: any) => string[];
  resolveTargetId: (overData: any) => string | null;
  onStack: (sourceIds: string[], targetId: string) => void;
}

/**
 * Shared decision logic for drop-to-stack vs reorder branches across views.
 */
export function useStackDragEnd({
  stackTargetKind,
  resolveSourceIds,
  resolveTargetId,
  onStack,
}: UseStackDragEndOpts) {
  const handleStackDrop = useCallback(
    (active: Active | null, over: Over | null): boolean => {
      if (!active || !over) return false;

      const overData = over.data?.current;
      if (overData?.kind !== stackTargetKind) {
        return false;
      }

      const activeData = { id: active.id, ...active.data?.current };
      const sourceIds = resolveSourceIds(activeData);
      const targetId = resolveTargetId(overData);

      if (!targetId || !sourceIds || sourceIds.length === 0) {
        return false;
      }

      const targetStr = String(targetId);
      const activeIdStr = String(active.id);
      const overIdStr = String(over.id);

      if (
        activeIdStr === overIdStr ||
        activeIdStr === targetStr ||
        sourceIds.includes(targetStr)
      ) {
        return false;
      }

      onStack(sourceIds, targetStr);
      return true;
    },
    [stackTargetKind, resolveSourceIds, resolveTargetId, onStack]
  );

  return { handleStackDrop };
}
