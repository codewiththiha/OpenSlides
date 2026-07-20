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
    if (searchResultIds) return ordered.filter((slide) => searchResultIds.has(slide.id));
    return ordered.map((slide) => ({ slide, haystack: `${slide.name ?? ""}\n${slide.code}`.toLowerCase() })).filter(({ haystack }) => haystack.includes(q)).map(({ slide }) => slide);
  }, [ordered, searchQuery, searchResultIds]);
  const clearSearch = useCallback(() => setRawSearchQuery(""), []);
  return { rawSearchQuery, setRawSearchQuery, searchQuery, clearSearch, filteredOrdered };
}
