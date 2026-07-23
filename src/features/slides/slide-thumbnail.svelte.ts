import { shikiDisplayHtml } from "$lib/shiki/shiki-display.svelte";
import { api } from "$lib/lib/tauri-api";
import { LruMap } from "$lib/lib/lru-map";

const MAX_CACHE_ENTRIES = 120;
const MAX_LINES = 6;
const MAX_CHARS = 400;
const REQUEST_DEBOUNCE_MS = 400;

type ThumbnailEntry = { html: string };
const cache = new LruMap<string, ThumbnailEntry>(MAX_CACHE_ENTRIES);

function truncateCode(code: string, maxLines: number, maxChars: number): string {
  return code.split("\n").slice(0, maxLines).join("\n").slice(0, maxChars);
}

export interface SlideThumbnailArgs {
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

export function createSlideThumbnail(args: () => SlideThumbnailArgs) {
  let el = $state<HTMLDivElement | null>(null);
  let entry = $state<ThumbnailEntry | null>(null);
  let inView = $state(typeof IntersectionObserver === "undefined");
  let entryKey = "";

  const truncatedCode = $derived(
    truncateCode(args().code, args().maxLines ?? MAX_LINES, args().maxChars ?? MAX_CHARS),
  );
  const key = $derived(
    `${args().slideId} ${args().theme} ${args().language} ${truncatedCode}`,
  );

  $effect(() => {
    const k = key;
    const initialHtml = args().initialHtml;
    const cached = cache.get(k);
    if (cached) {
      entryKey = k;
      entry = cached;
      return;
    }
    if (initialHtml) {
      const initial = { html: initialHtml };
      cache.set(k, initial);
      entryKey = k;
      entry = initial;
      return;
    }
    entryKey = k;
    entry = null;
    inView = typeof IntersectionObserver === "undefined";

    const element = el;
    if (typeof IntersectionObserver === "undefined" || !element) {
      inView = true;
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((item) => item.isIntersecting)) {
          inView = true;
          observer.disconnect();
        }
      },
      { rootMargin: "120px" },
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  });

  const shouldRequest = $derived(
    (args().enabled ?? true) && !entry && inView && !!truncatedCode,
  );

  const display = shikiDisplayHtml(() => ({
    code: truncatedCode,
    language: args().language,
    theme: args().theme,
    resetKey: key,
    debounceMs: args().debounceMs ?? REQUEST_DEBOUNCE_MS,
    priority: args().priority ?? "low",
    enabled: shouldRequest,
    policyName: "thumbnail",
  }));

  $effect(() => {
    const freshHtml = display.html;
    if (!freshHtml || entry) return;
    const k = key;
    const next = { html: freshHtml };
    cache.set(k, next);
    entryKey = k;
    entry = next;
    void api.cacheThumbnail(args().slideId, args().code, freshHtml).catch(() => undefined);
  });

  return {
    get html() {
      return entry?.html ?? null;
    },
    get el() {
      return el;
    },
    set el(v: HTMLDivElement | null) {
      el = v;
    },
    /** True once the current entry matches the current cache key. */
    get isCurrent() {
      return !!entry && entryKey === key;
    },
  };
}
