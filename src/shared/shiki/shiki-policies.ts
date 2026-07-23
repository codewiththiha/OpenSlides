/**
 * Retention policies that decide whether a Shiki display keeps its last
 * good output while a new one loads (or clears for unsafe states).
 */

type RetentionPolicy = "clear" | "keep-last";
export type ShikiDisplayStatus =
  | "disabled"
  | "empty"
  | "too-large"
  | "loading"
  | "ready"
  | "error";

export interface ShikiDisplayPolicy {
  loadingPolicy: RetentionPolicy;
  errorPolicy: RetentionPolicy;
  emptyPolicy: RetentionPolicy;
  largeCodePolicy: RetentionPolicy;
  disabledPolicy: RetentionPolicy;
  maxCodeLength: number;
}

export const SHIKI_DISPLAY_POLICIES = {
  /** Editor overlay: keep current same-document HTML while typing, clear unsafe states. */
  editor: {
    loadingPolicy: "keep-last",
    errorPolicy: "clear",
    emptyPolicy: "clear",
    largeCodePolicy: "clear",
    disabledPolicy: "clear",
    maxCodeLength: 20_000,
  },
  /** Thumbnails should never cache or show stale HTML for another cache key. */
  thumbnail: {
    loadingPolicy: "clear",
    errorPolicy: "clear",
    emptyPolicy: "clear",
    largeCodePolicy: "clear",
    disabledPolicy: "clear",
    maxCodeLength: 20_000,
  },
  /** Small static previews can disappear on failures instead of keeping stale theme HTML. */
  previewTile: {
    loadingPolicy: "keep-last",
    errorPolicy: "clear",
    emptyPolicy: "clear",
    largeCodePolicy: "clear",
    disabledPolicy: "clear",
    maxCodeLength: 20_000,
  },
  /** MagicMove preview keeps the previous highlighter while a new theme/language loads. */
  magicMove: {
    loadingPolicy: "keep-last",
    errorPolicy: "clear",
    emptyPolicy: "clear",
    largeCodePolicy: "clear",
    disabledPolicy: "clear",
    maxCodeLength: 20_000,
  },
} as const satisfies Record<string, ShikiDisplayPolicy>;

export type ShikiDisplayPolicyName = keyof typeof SHIKI_DISPLAY_POLICIES;

export function resolvePolicy(
  policyName: ShikiDisplayPolicyName | undefined,
  policy: Partial<ShikiDisplayPolicy> | undefined,
): ShikiDisplayPolicy {
  return {
    ...SHIKI_DISPLAY_POLICIES[policyName ?? "editor"],
    ...policy,
  };
}
