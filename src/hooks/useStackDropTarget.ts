import { useDroppable } from "@dnd-kit/core";

/**
 * Shared drop target hook for stack zones (center strip in slide strip and whole card in dashboard).
 */
export function useStackDropTarget(
  id: string,
  data: Record<string, unknown>,
  disabled: boolean = false,
) {
  const { setNodeRef, isOver } = useDroppable({ id, data, disabled });
  return { setNodeRef, isOver };
}
