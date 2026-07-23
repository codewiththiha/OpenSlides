/**
 * Lightweight pointer-based drag manager for the project dashboard —
 * stacking only (there is no dashboard reorder):
 *  - 8px activation threshold before a drag session starts
 *  - rect-intersection hit testing against [data-chunk-id] cells, which
 *    works through the fixed StackSpread backdrop (elementFromPoint would
 *    not)
 *  - the moving overlay clone is rendered by ProjectGrid
 */
import type { GroupChunk } from "$lib/lib/grouping";
import type { ProjectSummary } from "$lib/types";

export type ProjectDragPayload =
  | { kind: "project-cell"; chunk: GroupChunk<ProjectSummary> }
  | { kind: "fan-item"; project: ProjectSummary; groupId?: string };

export interface ProjectDragSession {
  payload: ProjectDragPayload;
  /** Finger-down spot. */
  startX: number;
  startY: number;
  x: number;
  y: number;
  /** px the pointer must travel before the session becomes an active drag. */
  threshold: number;
  /** true once the threshold was crossed (overlay visible). */
  active: boolean;
  /** Width of the dragged cell/card, for the overlay clone. */
  width: number | null;
  /** Top-left of the dragged element at grab time (overlay anchor). */
  originLeft: number;
  originTop: number;
  /** data-chunk-id of the grid cell currently under the pointer. */
  hoverChunkId: string | null;
}

export const projectDnd = $state<{ session: ProjectDragSession | null }>({
  session: null,
});

export type ProjectDropHandler = (session: ProjectDragSession) => void;

let dropHandler: ProjectDropHandler | null = null;
/** ProjectGridView registers its resolver while mounted. */
export function setProjectDropHandler(fn: ProjectDropHandler | null) {
  dropHandler = fn;
}

const CHUNK_SELECTOR = "[data-chunk-id]";

/** Hit test: the cell whose rect contains the pointer. */
function hitChunk(x: number, y: number): string | null {
  const els = document.querySelectorAll<HTMLElement>(CHUNK_SELECTOR);
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
      return el.getAttribute("data-chunk-id");
    }
  }
  return null;
}

const ACTIVE_CLASS = "project-dnd-active";

/* Hit-testing queries the DOM, so it runs at most once per frame. */
let hitRaf = 0;

function scheduleHitTest() {
  if (hitRaf) return;
  hitRaf = requestAnimationFrame(() => {
    hitRaf = 0;
    const s = projectDnd.session;
    if (s?.active) {
      s.hoverChunkId = hitChunk(s.x, s.y);
    }
  });
}

function onMove(e: PointerEvent) {
  const s = projectDnd.session;
  if (!s) return;
  s.x = e.clientX;
  s.y = e.clientY;
  if (!s.active && Math.hypot(s.x - s.startX, s.y - s.startY) >= s.threshold) {
    s.active = true;
  }
  if (s.active) {
    document.documentElement.classList.add(ACTIVE_CLASS);
    scheduleHitTest();
  }
}

function onUp() {
  const s = projectDnd.session;
  cleanup();
  projectDnd.session = null;
  if (s?.active) {
    // Finalize synchronously: one last hit test at the release point.
    s.hoverChunkId = hitChunk(s.x, s.y);
    dropHandler?.(s);
  }
}

function cleanup() {
  window.removeEventListener("pointermove", onMove);
  window.removeEventListener("pointerup", onUp);
  window.removeEventListener("pointercancel", onUp);
  if (hitRaf) {
    cancelAnimationFrame(hitRaf);
    hitRaf = 0;
  }
  document.documentElement.classList.remove(ACTIVE_CLASS);
}

function cancelProjectDrag() {
  cleanup();
  projectDnd.session = null;
}

/**
 * Attach listeners for a possible drag. Call from a pointerdown handler;
 * clicks (< 8px travel) never turn into drags, so nested buttons, rename
 * inputs, and card-open clicks keep working.
 */
export function beginProjectDrag(
  payload: ProjectDragPayload,
  e: PointerEvent | MouseEvent,
  opts: {
    width?: number | null;
    threshold?: number;
    originLeft?: number;
    originTop?: number;
  } = {},
) {
  if ("button" in e && e.button !== 0) return;
  cancelProjectDrag();
  projectDnd.session = {
    payload,
    startX: e.clientX,
    startY: e.clientY,
    x: e.clientX,
    y: e.clientY,
    threshold: opts.threshold ?? 8,
    active: false,
    width: opts.width ?? null,
    originLeft: opts.originLeft ?? e.clientX,
    originTop: opts.originTop ?? e.clientY,
    hoverChunkId: null,
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
}
