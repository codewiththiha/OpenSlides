import { requestHtml } from "$lib/shiki/shiki-worker-client";
import { isTestEnv } from "$lib/lib/env";
import {
  resolvePolicy,
  type ShikiDisplayPolicy,
  type ShikiDisplayPolicyName,
  type ShikiDisplayStatus,
} from "./shiki-policies";

export interface ShikiDisplayHtmlArgs {
  code: string;
  language: string;
  theme: string;
  resetKey?: string;
  debounceMs?: number;
  priority?: "high" | "low";
  enabled?: boolean;
  policyName?: ShikiDisplayPolicyName;
  policy?: Partial<ShikiDisplayPolicy>;
}

export function shikiDisplayHtml(args: () => ShikiDisplayHtmlArgs) {
  const resolvedPolicy = $derived(
    resolvePolicy(args().policyName ?? "editor", args().policy),
  );
  const activeKey = $derived(
    `${args().resetKey ?? ""} ${args().language} ${args().theme}`,
  );

  let html = $state<string | null>(null);
  let htmlForKey = $state("");
  let lastHtml = $state<string | null>(null);
  let status = $state<ShikiDisplayStatus>("loading");
  let error = $state<Error | null>(null);
  let lastActiveKey = "";

  function clearCurrent(key: string) {
    lastHtml = null;
    htmlForKey = key;
    html = null;
  }

  $effect(() => {
    const key = activeKey;
    const a = args();
    const code = a.code;
    const enabled = a.enabled ?? true;
    const debounceMs = a.debounceMs ?? 80;
    const priority = a.priority ?? "high";
    const policy = resolvedPolicy;

    if (lastActiveKey !== key) {
      lastActiveKey = key;
      lastHtml = null;
      htmlForKey = "";
    }

    error = null;
    const isEmpty = code.length === 0;
    const isTooLarge = code.length > policy.maxCodeLength;

    if (!enabled) {
      status = "disabled";
      if (policy.disabledPolicy === "clear") clearCurrent(key);
      return;
    }
    if (isEmpty) {
      status = "empty";
      if (policy.emptyPolicy === "clear") clearCurrent(key);
      return;
    }
    if (isTooLarge) {
      status = "too-large";
      if (policy.largeCodePolicy === "clear") clearCurrent(key);
      return;
    }

    status = "loading";
    if (policy.loadingPolicy === "clear") clearCurrent(key);

    const actualDebounce = isTestEnv() ? 0 : debounceMs;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      requestHtml(code, a.language, a.theme, controller.signal, priority)
        .then((response) => {
          if (controller.signal.aborted || !response.html || lastActiveKey !== key) return;
          lastHtml = response.html;
          htmlForKey = key;
          html = response.html;
          status = "ready";
        })
        .catch((caught) => {
          if ((caught as DOMException)?.name === "AbortError") return;
          if (lastActiveKey !== key) return;
          const nextError = caught instanceof Error ? caught : new Error(String(caught));
          error = nextError;
          status = nextError.message === "code_too_large" ? "too-large" : "error";
          if (policy.errorPolicy === "clear" || nextError.message === "code_too_large") {
            clearCurrent(key);
          }
        });
    }, actualDebounce);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  });

  const displayHtml = $derived.by(() => {
    const key = activeKey;
    if (htmlForKey !== key) return null;
    const a = args();
    const enabled = a.enabled ?? true;
    const isEmpty = a.code.length === 0;
    const isTooLarge = a.code.length > resolvedPolicy.maxCodeLength;
    const invalidClear =
      (!enabled && resolvedPolicy.disabledPolicy === "clear") ||
      (isEmpty && resolvedPolicy.emptyPolicy === "clear") ||
      (isTooLarge && resolvedPolicy.largeCodePolicy === "clear") ||
      (status === "error" && resolvedPolicy.errorPolicy === "clear") ||
      (status === "loading" && resolvedPolicy.loadingPolicy === "clear");
    return invalidClear ? null : (html ?? lastHtml);
  });

  return {
    get html() {
      return displayHtml;
    },
    get status() {
      return status;
    },
    get error() {
      return error;
    },
    get isLoading() {
      return status === "loading";
    },
    get isReady() {
      return status === "ready";
    },
    get shouldUseFallback() {
      return displayHtml === null;
    },
  };
}

/**
 * Shared Shiki worker display state for the editor HTML overlay —
 * high priority, short debounce, editor retention policy.
 */
export function editorShikiHtml(
  args: () => Pick<ShikiDisplayHtmlArgs, "code" | "language" | "theme" | "resetKey">,
) {
  return shikiDisplayHtml(() => ({
    ...args(),
    debounceMs: 80,
    priority: "high",
    policyName: "editor",
  }));
}
