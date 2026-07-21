import { useCallback, useEffect, useMemo, useState } from "react";
import { useDebounce } from "use-debounce";
import { api } from "@/lib/tauri-api";
import type { Slide } from "@/types";

export function useSlideStripSearch({ projectId, ordered }: { projectId: string; ordered: Slide[] }) {
  const [rawSearchQuery, setRawSearchQuery] = useState("");
  const [debouncedSearchQuery] = useDebounce(rawSearchQuery, 180);
  const searchQuery = rawSearchQuery.trim() ? debouncedSearchQuery : "";
  const [searchResultIds, setSearchResultIds] = useState<Set<string> | null>(null);
  useEffect(() => {
    let cancelled = false;
    setSearchResultIds(null);
    if (!searchQuery.trim()) return;
    api.searchSlides(projectId, searchQuery).then((ids) => {
      if (!cancelled) setSearchResultIds(new Set(ids));
    }).catch(() => {
      if (!cancelled) setSearchResultIds(null);
    });
    return () => { cancelled = true; };
  }, [projectId, searchQuery]);
  const filteredOrdered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ordered;

    let initialMatches: Slide[];
    if (searchResultIds) {
      initialMatches = ordered.filter((slide) => searchResultIds.has(slide.id));
    } else {
      initialMatches = ordered
        .map((slide) => ({ slide, haystack: `${slide.name ?? ""}\n${slide.code}`.toLowerCase() }))
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
        Boolean(slide.sectionId && matchedSections.has(slide.sectionId.trim()))
    );
  }, [ordered, searchQuery, searchResultIds]);
  const clearSearch = useCallback(() => setRawSearchQuery(""), []);
  return { rawSearchQuery, setRawSearchQuery, searchQuery, clearSearch, filteredOrdered };
}
