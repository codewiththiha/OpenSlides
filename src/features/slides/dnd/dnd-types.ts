/**
 * Shared shapes for the slide-strip drag modules.
 */
import type { Slide } from "$lib/types";

export interface StackHoverRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

/** A stackable card on the strip, reduced to what the geometry needs. */
export interface StackHoverElement {
  id: string;
  /** Slide section (stack) this card belongs to, if any. */
  section: string | null;
  rect: StackHoverRect;
}

export interface StripItemLike {
  id: string;
  slides: Slide[];
  isDndShadowItem?: boolean;
}

/** What the finalize pass should commit, if anything. */
export type FinalizeDecision =
  | { kind: "restore" } // filtering or missing source — restore base visuals
  | { kind: "noop" }
  | { kind: "stack"; targetId: string }
  | { kind: "reorder"; nextIds: string[] };
