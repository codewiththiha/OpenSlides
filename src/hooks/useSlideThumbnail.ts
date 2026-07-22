import { useEffect, useRef, useState } from "react";
import { useShikiDisplayHtml } from "./useShikiDisplayState";
import { api } from "@/lib/tauri-api";
import { LruMap } from "@/lib/lru-map";

const MAX_CACHE_ENTRIES = 120;
const MAX_LINES = 6;
const MAX_CHARS = 400;
const REQUEST_DEBOUNCE_MS = 400;

type ThumbnailEntry = { html: string };
const cache = new LruMap<string, ThumbnailEntry>(MAX_CACHE_ENTRIES);

function truncateCode(code: string, maxLines: number, maxChars: number): string {
  return code.split("\n").slice(0, maxLines).join("\n").slice(0, maxChars);
}

interface Args {
  slideId: string;
  code: string;
  theme: string;
  language: string;
  initialHtml?: string;
  maxLines?: number;
  maxChars?: number;
  enabled?: boolean;
  priority?: "high" | "low";
  debounceMs?: number;
}

export function useSlideThumbnail({
  slideId,
  code,
  theme,
  language,
  initialHtml,
  maxLines = MAX_LINES,
  maxChars = MAX_CHARS,
  enabled = true,
  priority = "low",
  debounceMs = REQUEST_DEBOUNCE_MS,
}: Args) {
  const truncatedCode = truncateCode(code, maxLines, maxChars);
  const key = `${slideId}\u0000${theme}\u0000${language}\u0000${truncatedCode}`;
  const elementRef = useRef<HTMLDivElement>(null);
  const [entry, setEntry] = useState<ThumbnailEntry | null>(() => cache.get(key) ?? null);
  const [inView, setInView] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const cached = cache.get(key);
    if (cached) {
      setEntry(cached);
      return;
    }
    if (initialHtml) {
      const initial = { html: initialHtml };
      cache.set(key, initial);
      setEntry(initial);
      return;
    }
    setEntry(null);
    setInView(typeof IntersectionObserver === "undefined");

    const element = elementRef.current;
    if (typeof IntersectionObserver === "undefined" || !element) {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((item) => item.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "120px" },
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [key, initialHtml]);

  const shouldRequest = enabled && !entry && inView && !!truncatedCode;
  const { html: freshHtml } = useShikiDisplayHtml({
    code: truncatedCode,
    language,
    theme,
    resetKey: key,
    debounceMs,
    priority,
    enabled: shouldRequest,
    policyName: "thumbnail",
  });

  useEffect(() => {
    if (!freshHtml || entry) return;
    const next = { html: freshHtml };
    cache.set(key, next);
    setEntry(next);
    void api.cacheThumbnail(slideId, code, freshHtml).catch(() => undefined);
  }, [freshHtml, entry, key, slideId, code]);

  return { html: entry?.html ?? null, ref: elementRef };
}
