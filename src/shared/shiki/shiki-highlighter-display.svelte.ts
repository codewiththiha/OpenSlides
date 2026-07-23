import type { Highlighter } from "shiki";
import { getHighlighter } from "$lib/shiki/shiki-instance";
import {
  resolvePolicy,
  type ShikiDisplayPolicy,
  type ShikiDisplayPolicyName,
  type ShikiDisplayStatus,
} from "./shiki-policies";

interface ShikiHighlighterDisplayArgs {
  theme: string;
  language: string;
  enabled?: boolean;
  policyName?: ShikiDisplayPolicyName;
  policy?: Pick<
    Partial<ShikiDisplayPolicy>,
    "loadingPolicy" | "errorPolicy" | "disabledPolicy"
  >;
}

function shikiHighlighterDisplay(args: () => ShikiHighlighterDisplayArgs) {
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
  let status = $state<ShikiDisplayStatus>(
    args().enabled === false ? "disabled" : "loading",
  );
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
        const nextError =
          caught instanceof Error ? caught : new Error(String(caught));
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
      return shouldUseFallback
        ? args().theme
        : (displayState?.theme ?? args().theme);
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

/** MagicMove/highlighter display state with the `magicMove` retention policy. */
export function magicMoveShikiDisplay(
  args: () => { theme: string; language: string },
) {
  return shikiHighlighterDisplay(() => ({
    ...args(),
    policyName: "magicMove",
  }));
}
