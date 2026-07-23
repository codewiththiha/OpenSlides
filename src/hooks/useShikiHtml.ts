import {
  useShikiDisplayHtml,
  type ShikiDisplayHtmlArgs,
} from "./useShikiDisplayState.svelte";

type StaleHtmlPolicy = "clear" | "keep-last";

interface UseShikiHtmlArgs extends ShikiDisplayHtmlArgs {
  errorPolicy?: StaleHtmlPolicy;
  emptyPolicy?: StaleHtmlPolicy;
  largeCodePolicy?: StaleHtmlPolicy;
  disabledPolicy?: StaleHtmlPolicy;
  loadingPolicy?: StaleHtmlPolicy;
  maxCodeLength?: number;
}

/**
 * HTML-only facade over the authoritative Shiki display policy hook.
 * New code that needs loading/error/fallback state should call
 * `useShikiDisplayHtml` directly.
 */
export function useShikiHtml(args: () => UseShikiHtmlArgs) {
  return useShikiDisplayHtml(() => {
    const a = args();
    const policy: ShikiDisplayHtmlArgs["policy"] = {};
    if (a.errorPolicy) policy.errorPolicy = a.errorPolicy;
    if (a.emptyPolicy) policy.emptyPolicy = a.emptyPolicy;
    if (a.largeCodePolicy) policy.largeCodePolicy = a.largeCodePolicy;
    if (a.disabledPolicy) policy.disabledPolicy = a.disabledPolicy;
    if (a.loadingPolicy) policy.loadingPolicy = a.loadingPolicy;
    if (a.maxCodeLength !== undefined) policy.maxCodeLength = a.maxCodeLength;
    return { ...a, policyName: a.policyName ?? "editor", policy };
  });
}
