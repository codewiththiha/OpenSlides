import { api } from "$lib/lib/tauri-api";
import type { Slide } from "$lib/types";

export function useSlideStripSearch(args: {
  projectId: string;
  ordered: () => Slide[];
}) {
  let rawSearchQuery = $state("");
  let debouncedSearchQuery = $state("");
  let searchResultIds = $state<Set<string> | null>(null);

  // use-debounce replacement: $effect + setTimeout
  $effect(() => {
    const q = rawSearchQuery;
    const t = window.setTimeout(() => {
      debouncedSearchQuery = q;
    }, 180);
    return () => window.clearTimeout(t);
  });

  const searchQuery = $derived(rawSearchQuery.trim() ? debouncedSearchQuery : "");

  $effect(() => {
    const q = searchQuery;
    let cancelled = false;
    searchResultIds = null;
    if (!q.trim()) return;
    api
      .searchSlides(args.projectId, q)
      .then((ids) => {
        if (!cancelled) searchResultIds = new Set(ids);
      })
      .catch(() => {
        if (!cancelled) searchResultIds = null;
      });
    return () => {
      cancelled = true;
    };
  });

  const filteredOrdered = $derived.by(() => {
    const ordered = args.ordered();
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ordered;

    let initialMatches: Slide[];
    const ids = searchResultIds;
    if (ids) {
      initialMatches = ordered.filter((slide) => ids.has(slide.id));
    } else {
      initialMatches = ordered
        .map((slide) => ({
          slide,
          haystack: `${slide.name ?? ""}\n${slide.code}`.toLowerCase(),
        }))
        .filter(({ haystack }) => haystack.includes(q))
        .map(({ slide }) => slide);
    }

    const matchedIds = new Set(initialMatches.map((s) => s.id));
    const matchedSections = new Set<string>();
    for (const s of initialMatches) {
      if (s.sectionId && s.sectionId.trim().length > 0) {
        matchedSections.add(s.sectionId.trim());
      }
    }

    return ordered.filter(
      (slide) =>
        matchedIds.has(slide.id) ||
        Boolean(slide.sectionId && matchedSections.has(slide.sectionId.trim())),
    );
  });

  function clearSearch() {
    rawSearchQuery = "";
  }

  return {
    get rawSearchQuery() {
      return rawSearchQuery;
    },
    set rawSearchQuery(v: string) {
      rawSearchQuery = v;
    },
    get searchQuery() {
      return searchQuery;
    },
    clearSearch,
    get filteredOrdered() {
      return filteredOrdered;
    },
  };
}
