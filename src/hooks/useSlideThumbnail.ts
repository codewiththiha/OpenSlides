import { useEffect, useRef, useState } from "react";
import { requestHtml } from "@/lib/shiki-worker-client";

const MAX_CACHE_ENTRIES = 120;
const MAX_LINES = 6;
const MAX_CHARS = 400;
const REQUEST_DEBOUNCE_MS = 400;

type ThumbnailEntry = { html: string };
const cache = new Map<string, ThumbnailEntry>();

function readCache(key: string): ThumbnailEntry | null {
  const value = cache.get(key);
  if (!value) return null;
  // Touch the entry so the Map insertion order acts as an LRU.
  cache.delete(key);
  cache.set(key, value);
  return value;
}

function writeCache(key: string, value: ThumbnailEntry) {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function truncateCode(code: string): string {
  return code.split("\n").slice(0, MAX_LINES).join("\n").slice(0, MAX_CHARS);
}

interface Args {
  slideId: string;
  code: string;
  theme: string;
  language: string;
}

export function useSlideThumbnail({ slideId, code, theme, language }: Args) {
  const truncatedCode = truncateCode(code);
  const key = `${slideId}\u0000${theme}\u0000${language}\u0000${truncatedCode}`;
  const elementRef = useRef<HTMLDivElement>(null);
  const [entry, setEntry] = useState<ThumbnailEntry | null>(() => readCache(key));

  useEffect(() => {
    const cached = readCache(key);
    setEntry(cached);
    if (cached || !truncatedCode) return;

    const controller = new AbortController();
    let timer: number | null = null;
    let observer: IntersectionObserver | null = null;
    let requested = false;

    const request = () => {
      if (requested || controller.signal.aborted) return;
      requested = true;
      timer = window.setTimeout(() => {
        requestHtml(truncatedCode, language, theme, controller.signal)
          .then((response) => {
            if (controller.signal.aborted || !response.html) return;
            const next = { html: response.html };
            writeCache(key, next);
            setEntry(next);
            observer?.disconnect();
          })
          .catch((error) => {
            if ((error as DOMException)?.name !== "AbortError") {
              // Keep the text fallback; thumbnails are progressive enhancement.
            }
          });
      }, REQUEST_DEBOUNCE_MS);
    };

    const element = elementRef.current;
    if (typeof IntersectionObserver === "undefined" || !element) {
      request();
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((item) => item.isIntersecting)) request();
        },
        { rootMargin: "120px" },
      );
      observer.observe(element);
    }

    return () => {
      controller.abort();
      if (timer !== null) window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, [key, language, theme, truncatedCode]);

  return { html: entry?.html ?? null, ref: elementRef };
}
