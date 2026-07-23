/**
 * Slide-strip search dialog state. Scope "slides" filters the strip live
 * (mirrors the dialog query into the strip filter); scope "code" hands the
 * query to the editor's find bar on submit.
 */
import { emitFindInCode, onOpenSearch } from "$lib/lib/app-events";
import { setIsBottomPanelCollapsed } from "$lib/stores/ui-state.svelte";
import type { SearchScope } from "@/features/slides/SlideSearchDialog.svelte";

interface StripSearchLike {
  rawSearchQuery: string;
  clearSearch: () => void;
}

export function createSlideStripSearchDialog(args: {
  search: StripSearchLike;
}) {
  let isOpen = $state(false);
  let scope = $state<SearchScope>("slides");
  let query = $state("");

  $effect(() => {
    return onOpenSearch(() => {
      setIsBottomPanelCollapsed(false);
      scope = "slides";
      query = args.search.rawSearchQuery;
      isOpen = true;
    });
  });

  function changeScope(next: SearchScope) {
    scope = next;
    if (next === "code") args.search.clearSearch();
    else args.search.rawSearchQuery = query;
  }

  function changeQuery(value: string) {
    query = value;
    if (scope === "slides") args.search.rawSearchQuery = value;
  }

  function submitCodeSearch() {
    emitFindInCode(query);
    isOpen = false;
  }

  function close() {
    isOpen = false;
    if (scope === "code") query = "";
  }

  return {
    get isOpen() {
      return isOpen;
    },
    get scope() {
      return scope;
    },
    get query() {
      return query;
    },
    changeScope,
    changeQuery,
    submitCodeSearch,
    close,
  };
}
