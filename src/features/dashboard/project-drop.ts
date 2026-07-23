import type { GroupChunk } from "$lib/lib/grouping";
import type { ProjectSummary } from "$lib/types";
import type {
  ProjectDragPayload,
  ProjectDragSession,
} from "./project-dnd.svelte";

/**
 * Pure dashboard drop decisions (§6.7): given a finished drag session and
 * the current chunks, decide which mutation the drop means. Mirrors the
 * slide strip's decideFinalize (§6.5) — the grid component only applies
 * the result.
 */
export type ProjectDropDecision =
  | { kind: "stack"; sourceIds: string[]; targetId: string }
  | { kind: "unstack"; projectId: string }
  | { kind: "none" };

/** Fan item must travel this far from its origin to count as "unstack". */
const UNSTACK_DISTANCE = 120;

export function chunkIdOf(chunk: GroupChunk<ProjectSummary>): string {
  return chunk.kind === "stack" && chunk.items.length > 1
    ? chunk.groupId!
    : chunk.items[0]!.id;
}

function sourceIdsOf(payload: ProjectDragPayload): string[] {
  if (payload.kind === "fan-item") return [payload.project.id];
  return payload.chunk.items.map((project) => project.id);
}

export function decideProjectDrop(
  session: ProjectDragSession,
  chunks: GroupChunk<ProjectSummary>[],
): ProjectDropDecision {
  const targetChunkId = session.hoverChunkId;
  const payload = session.payload;

  // Stack drop: only "drop on cell → stack" exists (no reorder).
  if (targetChunkId) {
    const targetChunk = chunks.find((c) => chunkIdOf(c) === targetChunkId);
    const targetId = targetChunk?.items[0]?.id ?? null;
    const sourceIds = sourceIdsOf(payload);
    const sourceCellId =
      payload.kind === "project-cell" ? chunkIdOf(payload.chunk) : null;
    if (
      targetId &&
      sourceIds.length > 0 &&
      sourceCellId !== targetChunkId &&
      !sourceIds.includes(targetId)
    ) {
      return { kind: "stack", sourceIds, targetId };
    }
  }

  // Fan item dragged far away from any cell → unstack it.
  if (payload.kind === "fan-item") {
    const dist = Math.hypot(
      session.x - session.startX,
      session.y - session.startY,
    );
    if (dist > UNSTACK_DISTANCE) {
      return { kind: "unstack", projectId: payload.project.id };
    }
  }

  return { kind: "none" };
}
