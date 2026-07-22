import { useEffect, useRef, useState } from "react";
import type { Highlighter } from "shiki";
import { requestHtml } from "@/lib/shiki-worker-client";
import { getHighlighter } from "@/lib/shiki-instance";

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

function resolvePolicy(
  policyName: ShikiDisplayPolicyName | undefined,
  policy: Partial<ShikiDisplayPolicy> | undefined,
): ShikiDisplayPolicy {
  return {
    ...SHIKI_DISPLAY_POLICIES[policyName ?? "editor"],
    ...policy,
  };
}

interface UseShikiDisplayHtmlArgs {
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

export function useShikiDisplayHtml({
  code,
  language,
  theme,
  resetKey = "",
  debounceMs = 80,
  priority = "high",
  enabled = true,
  policyName = "editor",
  policy,
}: UseShikiDisplayHtmlArgs) {
  const resolvedPolicy = resolvePolicy(policyName, policy);
  const lastRef = useRef<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [status, setStatus] = useState<ShikiDisplayStatus>("loading");
  const [error, setError] = useState<Error | null>(null);
  const activeKeyRef = useRef("");
  const htmlKeyRef = useRef("");
  const activeKey = `${resetKey}\u0000${language}\u0000${theme}`;
  const isEmpty = code.length === 0;
  const isTooLarge = code.length > resolvedPolicy.maxCodeLength;

  const clearCurrent = () => {
    lastRef.current = null;
    htmlKeyRef.current = activeKey;
    setHtml(null);
  };

  if (activeKeyRef.current !== activeKey) {
    activeKeyRef.current = activeKey;
    lastRef.current = null;
    htmlKeyRef.current = "";
  }

  useEffect(() => {
    setError(null);

    if (!enabled) {
      setStatus("disabled");
      if (resolvedPolicy.disabledPolicy === "clear") clearCurrent();
      return;
    }
    if (isEmpty) {
      setStatus("empty");
      if (resolvedPolicy.emptyPolicy === "clear") clearCurrent();
      return;
    }
    if (isTooLarge) {
      setStatus("too-large");
      if (resolvedPolicy.largeCodePolicy === "clear") clearCurrent();
      return;
    }

    setStatus("loading");
    if (resolvedPolicy.loadingPolicy === "clear") clearCurrent();

    const isTestEnv =
      (typeof window !== "undefined" && (window as any).IS_REACT_ACT_ENVIRONMENT) ||
      (typeof globalThis !== "undefined" && (globalThis as any).IS_REACT_ACT_ENVIRONMENT);
    const actualDebounce = isTestEnv ? 0 : debounceMs;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      requestHtml(code, language, theme, controller.signal, priority)
        .then((response) => {
          if (controller.signal.aborted || !response.html || activeKeyRef.current !== activeKey) return;
          lastRef.current = response.html;
          htmlKeyRef.current = activeKey;
          setHtml(response.html);
          setStatus("ready");
        })
        .catch((caught) => {
          if ((caught as DOMException)?.name === "AbortError") return;
          if (activeKeyRef.current !== activeKey) return;
          const nextError = caught instanceof Error ? caught : new Error(String(caught));
          setError(nextError);
          setStatus(nextError.message === "code_too_large" ? "too-large" : "error");
          if (resolvedPolicy.errorPolicy === "clear" || nextError.message === "code_too_large") {
            clearCurrent();
          }
        });
    }, actualDebounce);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    code,
    language,
    theme,
    activeKey,
    debounceMs,
    priority,
    enabled,
    policyName,
    policy,
    resolvedPolicy.loadingPolicy,
    resolvedPolicy.errorPolicy,
    resolvedPolicy.emptyPolicy,
    resolvedPolicy.largeCodePolicy,
    resolvedPolicy.disabledPolicy,
    resolvedPolicy.maxCodeLength,
    isEmpty,
    isTooLarge,
  ]);

  let displayHtml: string | null = null;
  if (htmlKeyRef.current === activeKey) {
    const invalidClear =
      (!enabled && resolvedPolicy.disabledPolicy === "clear") ||
      (isEmpty && resolvedPolicy.emptyPolicy === "clear") ||
      (isTooLarge && resolvedPolicy.largeCodePolicy === "clear") ||
      (status === "error" && resolvedPolicy.errorPolicy === "clear") ||
      (status === "loading" && resolvedPolicy.loadingPolicy === "clear");
    displayHtml = invalidClear ? null : html ?? lastRef.current;
  }

  return {
    html: displayHtml,
    status,
    error,
    isLoading: status === "loading",
    isReady: status === "ready",
    shouldUseFallback: displayHtml === null,
  };
}

interface UseShikiHighlighterDisplayArgs {
  theme: string;
  language: string;
  enabled?: boolean;
  policyName?: ShikiDisplayPolicyName;
  policy?: Pick<Partial<ShikiDisplayPolicy>, "loadingPolicy" | "errorPolicy" | "disabledPolicy">;
}

export function useShikiHighlighterDisplay({
  theme,
  language,
  enabled = true,
  policyName = "magicMove",
  policy,
}: UseShikiHighlighterDisplayArgs) {
  const resolvedPolicy = resolvePolicy(policyName, policy);
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const [displayState, setDisplayState] = useState<{
    highlighter: Highlighter;
    theme: string;
    language: string;
  } | null>(null);
  const [status, setStatus] = useState<ShikiDisplayStatus>(enabled ? "loading" : "disabled");
  const [error, setError] = useState<Error | null>(null);
  const requestedKey = `${theme}-${language}`;

  useEffect(() => {
    if (!enabled) {
      setStatus("disabled");
      setError(null);
      if (resolvedPolicy.disabledPolicy === "clear") setDisplayState(null);
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setError(null);
    if (resolvedPolicy.loadingPolicy === "clear") setDisplayState(null);

    getHighlighter(theme, language)
      .then((nextHighlighter) => {
        if (cancelled) return;
        setHighlighter(nextHighlighter);
        setReadyKey(requestedKey);
        setDisplayState({ highlighter: nextHighlighter, theme, language });
        setStatus("ready");
      })
      .catch((caught) => {
        if (cancelled) return;
        const nextError = caught instanceof Error ? caught : new Error(String(caught));
        setReadyKey(null);
        setError(nextError);
        setStatus("error");
        if (resolvedPolicy.errorPolicy === "clear") setDisplayState(null);
      });

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    theme,
    language,
    requestedKey,
    policyName,
    policy,
    resolvedPolicy.loadingPolicy,
    resolvedPolicy.errorPolicy,
    resolvedPolicy.disabledPolicy,
  ]);

  const isCurrentReady = readyKey === requestedKey && !!highlighter;
  const shouldUseFallback =
    status === "error" ||
    status === "disabled" ||
    (!displayState && (status !== "loading" || resolvedPolicy.loadingPolicy === "clear"));

  return {
    highlighter,
    status,
    error,
    shikiLoadFailed: status === "error",
    displayHighlighter: shouldUseFallback ? null : displayState?.highlighter ?? null,
    displayTheme: shouldUseFallback ? theme : displayState?.theme ?? theme,
    displayLanguage: shouldUseFallback ? language : displayState?.language ?? language,
    isLoading: status === "loading",
    isReady: isCurrentReady,
    shouldUseFallback,
  };
}
