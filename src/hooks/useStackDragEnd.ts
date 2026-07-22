import { useCallback } from "react";
import type { Active, Over } from "@dnd-kit/core";

/** Minimum shape shared by draggable stack sources. */
export interface StackDragData {
  kind: string;
  id: string;
}

/** Minimum shape shared by stack drop targets. */
export interface StackDropData {
  kind: string;
}

export interface UseStackDragEndOpts<
  Source extends StackDragData,
  Target extends StackDropData,
> {
  stackTargetKind: Target["kind"];
  resolveSourceIds: (activeData: Source) => string[];
  resolveTargetId: (overData: Target) => string | null;
  onStack: (sourceIds: string[], targetId: string) => void;
}

/** Shared decision logic for drop-to-stack vs reorder branches across views. */
export function useStackDragEnd<
  Source extends StackDragData,
  Target extends StackDropData,
>({
  stackTargetKind,
  resolveSourceIds,
  resolveTargetId,
  onStack,
}: UseStackDragEndOpts<Source, Target>) {
  const handleStackDrop = useCallback(
    (active: Active | null, over: Over | null): boolean => {
      if (!active || !over) return false;

      const overData = over.data?.current as Target | undefined;
      if (!overData || overData.kind !== stackTargetKind) return false;

      const activeData = {
        ...(active.data?.current as Partial<Source> | undefined),
        id: String(active.id),
      } as Source;
      const sourceIds = resolveSourceIds(activeData);
      const targetId = resolveTargetId(overData);

      if (!targetId || sourceIds.length === 0) return false;

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
    [stackTargetKind, resolveSourceIds, resolveTargetId, onStack],
  );

  return { handleStackDrop };
}
