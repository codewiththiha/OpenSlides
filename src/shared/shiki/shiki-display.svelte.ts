import type { Highlighter } from "shiki";
import { requestHtml } from "$lib/shiki/shiki-worker-client";
import { getHighlighter } from "$lib/shiki/shiki-instance";
import { isTestEnv } from "$lib/lib/env";

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

export interface ShikiHighlighterDisplayArgs {
  theme: string;
  language: string;
  enabled?: boolean;
  policyName?: ShikiDisplayPolicyName;
  policy?: Pick<
    Partial<ShikiDisplayPolicy>,
    "loadingPolicy" | "errorPolicy" | "disabledPolicy"
  >;
}

export function shikiHighlighterDisplay(args: () => ShikiHighlighterDisplayArgs) {
  const resolvedPolicy = $derived(
    resolvePolicy(args().policyName ?? "magicMove", args().policy),
  );
  const requestedKey = $derived(`${args().theme}-${args().language}`);

  let highlighter = $state<Highlighter | null>(null);
  let readyKey = $state<string | null>(null);
  let displayState = $state<{
    highlighter: Highlighter;
    theme: string;
    language: string;
  } | null>(null);
  let status = $state<ShikiDisplayStatus>(args().enabled === false ? "disabled" : "loading");
  let error = $state<Error | null>(null);

  $effect(() => {
    const theme = args().theme;
    const language = args().language;
    const enabled = args().enabled ?? true;
    const policy = resolvedPolicy;

    if (!enabled) {
      status = "disabled";
      error = null;
      if (policy.disabledPolicy === "clear") displayState = null;
      return;
    }

    let cancelled = false;
    status = "loading";
    error = null;
    if (policy.loadingPolicy === "clear") displayState = null;

    getHighlighter(theme, language)
      .then((nextHighlighter) => {
        if (cancelled) return;
        highlighter = nextHighlighter;
        readyKey = requestedKey;
        displayState = { highlighter: nextHighlighter, theme, language };
        status = "ready";
      })
      .catch((caught) => {
        if (cancelled) return;
        const nextError = caught instanceof Error ? caught : new Error(String(caught));
        readyKey = null;
        error = nextError;
        status = "error";
        if (policy.errorPolicy === "clear") displayState = null;
      });

    return () => {
      cancelled = true;
    };
  });

  const shouldUseFallback = $derived(
    status === "error" ||
      status === "disabled" ||
      (!displayState &&
        (status !== "loading" || resolvedPolicy.loadingPolicy === "clear")),
  );

  return {
    get highlighter() {
      return highlighter;
    },
    get status() {
      return status;
    },
    get error() {
      return error;
    },
    get shikiLoadFailed() {
      return status === "error";
    },
    get displayHighlighter() {
      return shouldUseFallback ? null : (displayState?.highlighter ?? null);
    },
    get displayTheme() {
      return shouldUseFallback ? args().theme : (displayState?.theme ?? args().theme);
    },
    get displayLanguage() {
      return shouldUseFallback
        ? args().language
        : (displayState?.language ?? args().language);
    },
    get isLoading() {
      return status === "loading";
    },
    get isReady() {
      return readyKey === requestedKey && !!highlighter;
    },
    get shouldUseFallback() {
      return shouldUseFallback;
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

/** MagicMove/highlighter display state with the `magicMove` retention policy. */
export function magicMoveShikiDisplay(args: () => { theme: string; language: string }) {
  return shikiHighlighterDisplay(() => ({
    ...args(),
    policyName: "magicMove",
  }));
}
