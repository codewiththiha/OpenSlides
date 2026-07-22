import { useMemo } from "react";
import {
  useShikiDisplayHtml,
  type ShikiDisplayPolicy,
  type ShikiDisplayPolicyName,
} from "./useShikiDisplayState";

type StaleHtmlPolicy = "clear" | "keep-last";

interface UseShikiHtmlArgs {
  code: string;
  language: string;
  theme: string;
  /** Clears retained HTML when an editor/slide identity changes. */
  resetKey?: string;
  debounceMs?: number;
  priority?: "high" | "low";
  enabled?: boolean;
  policyName?: ShikiDisplayPolicyName;
  /** What to render when the worker fails for the current request. */
  errorPolicy?: StaleHtmlPolicy;
  /** What to render when `code` is empty. */
  emptyPolicy?: StaleHtmlPolicy;
  /** What to render when `code` is too large for the worker. */
  largeCodePolicy?: StaleHtmlPolicy;
  /** What to render when the hook is disabled. */
  disabledPolicy?: StaleHtmlPolicy;
  loadingPolicy?: StaleHtmlPolicy;
  maxCodeLength?: number;
}

/**
 * Backwards-compatible HTML-only facade over the authoritative Shiki display
 * policy hook. New code that needs loading/error/fallback state should call
 * `useShikiDisplayHtml` directly.
 */
export function useShikiHtml({
  code,
  language,
  theme,
  resetKey = "",
  debounceMs = 80,
  priority = "high",
  enabled = true,
  policyName = "editor",
  errorPolicy,
  emptyPolicy,
  largeCodePolicy,
  disabledPolicy,
  loadingPolicy,
  maxCodeLength,
}: UseShikiHtmlArgs): string | null {
  const policy = useMemo<Partial<ShikiDisplayPolicy>>(() => {
    const next: Partial<ShikiDisplayPolicy> = {};
    if (errorPolicy) next.errorPolicy = errorPolicy;
    if (emptyPolicy) next.emptyPolicy = emptyPolicy;
    if (largeCodePolicy) next.largeCodePolicy = largeCodePolicy;
    if (disabledPolicy) next.disabledPolicy = disabledPolicy;
    if (loadingPolicy) next.loadingPolicy = loadingPolicy;
    if (maxCodeLength !== undefined) next.maxCodeLength = maxCodeLength;
    return next;
  }, [errorPolicy, emptyPolicy, largeCodePolicy, disabledPolicy, loadingPolicy, maxCodeLength]);

  return useShikiDisplayHtml({
    code,
    language,
    theme,
    resetKey,
    debounceMs,
    priority,
    enabled,
    policyName,
    policy,
  }).html;
}
