import { useEffect, useState } from "react";
import type { Highlighter } from "shiki";
import { getHighlighter } from "@/lib/shiki-instance";

interface UseShikiDisplayArgs {
  theme: string;
  language: string;
}

export function useShikiDisplay({ theme, language }: UseShikiDisplayArgs) {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const [shikiLoadFailed, setShikiLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const key = `${theme}-${language}`;
    setShikiLoadFailed(false);
    getHighlighter(theme, language).then((h) => {
      if (!cancelled) {
        setHighlighter(h);
        setReadyKey(key);
      }
    }).catch(() => {
      if (!cancelled) {
        setReadyKey(null);
        setShikiLoadFailed(true);
      }
    });
    return () => { cancelled = true; };
  }, [theme, language]);

  const canUseShiki = readyKey === `${theme}-${language}` && !!highlighter;

  /** Latch — holds previous theme/language while new one loads to prevent flicker. */
  const [displayState, setDisplayState] = useState<{
    highlighter: Highlighter;
    theme: string;
    language: string;
  } | null>(null);

  useEffect(() => {
    if (canUseShiki && highlighter) {
      setDisplayState({ highlighter, theme, language });
    }
  }, [canUseShiki, highlighter, theme, language]);

  return {
    highlighter,
    shikiLoadFailed,
    displayHighlighter: displayState?.highlighter ?? null,
    displayTheme: displayState?.theme ?? theme,
    displayLanguage: displayState?.language ?? language,
  };
}
