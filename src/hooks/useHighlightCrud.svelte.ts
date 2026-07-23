import { ui, setPreviewHighlightIndex } from "$lib/stores/ui-state.svelte";
import { useUpdateSlideSettings } from "$lib/queries";
import { selectionToRange } from "@/features/highlights/highlight-tokens";
import { createDefaultHighlight } from "@/features/highlights/highlight-factory";
import type { Highlight } from "$lib/types";

export interface HighlightCrudArgs {
  projectId: string;
  slideId: () => string | undefined;
  highlights: () => Highlight[];
  code: () => string;
  highlightMode: () => boolean;
  textarea: () => HTMLTextAreaElement | null;
  saveCaret: () => void;
}

export function useHighlightCrud(args: HighlightCrudArgs) {
  const mutation = useUpdateSlideSettings(args.projectId);

  let visible = $state(false);
  let position = $state({ x: 0, y: 0 });
  let pending = $state<{
    startLine: number;
    startChar: number;
    endLine: number;
    endChar: number;
  } | null>(null);
  let expandedId = $state<string | null>(null);

  function closeContextMenu() {
    visible = false;
  }

  function showAt(x: number, y: number) {
    const el = args.textarea();
    if (!args.highlightMode() || !el) return;
    const { selectionStart, selectionEnd } = el;
    if (selectionStart === selectionEnd) return;
    pending = selectionToRange(args.code(), selectionStart, selectionEnd);
    position = {
      x: Math.min(Math.max(8, x), Math.max(8, window.innerWidth - 188)),
      y: Math.min(Math.max(8, y - 84), Math.max(8, window.innerHeight - 92)),
    };
    visible = true;
  }

  function onContextMenu(e: MouseEvent) {
    if (!args.highlightMode()) return;
    e.preventDefault();
    showAt(e.clientX, e.clientY);
  }

  function onSelect() {
    args.saveCaret();
    const el = args.textarea();
    if (el && el.selectionStart === el.selectionEnd) visible = false;
  }

  function onMouseUp(e: MouseEvent) {
    args.saveCaret();
    const el = args.textarea();
    if (e.button === 0 && args.highlightMode() && el && el.selectionStart !== el.selectionEnd) {
      showAt(e.clientX, e.clientY);
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    args.saveCaret();
    const el = args.textarea();
    if (
      !e.shiftKey ||
      !args.highlightMode() ||
      visible ||
      !el ||
      el.selectionStart === el.selectionEnd
    ) {
      return;
    }
    const r = el.getBoundingClientRect();
    showAt(r.left + r.width / 2 - 90, r.top + 8);
  }

  function addPendingHighlight() {
    const slideId = args.slideId();
    if (!pending || !slideId) return;
    const hl = createDefaultHighlight(
      pending.startLine,
      pending.startChar,
      pending.endLine,
      pending.endChar,
    );
    mutation.mutate({ slideId, payload: { highlights: [...args.highlights(), hl] } });
    pending = null;
    expandedId = hl.id;
  }

  function updateHighlight(id: string, patch: Partial<Highlight>) {
    const slideId = args.slideId();
    if (!slideId) return;
    mutation.mutate({
      slideId,
      payload: {
        highlights: args.highlights().map((h) => (h.id === id ? { ...h, ...patch } : h)),
      },
    });
  }

  function deleteHighlight(id: string) {
    const slideId = args.slideId();
    if (!slideId) return;
    const highlights = args.highlights();
    const index = highlights.findIndex((h) => h.id === id);
    mutation.mutate({
      slideId,
      payload: { highlights: highlights.filter((h) => h.id !== id) },
    });
    if (expandedId === id) expandedId = null;
    if (index >= 0) {
      if (ui.previewHighlightIndex === index) setPreviewHighlightIndex(-1);
      else if (ui.previewHighlightIndex > index) setPreviewHighlightIndex(ui.previewHighlightIndex - 1);
    }
  }

  function moveHighlight(id: string, dir: -1 | 1) {
    const slideId = args.slideId();
    if (!slideId) return;
    const highlights = args.highlights();
    const from = highlights.findIndex((h) => h.id === id);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= highlights.length) return;
    const next = [...highlights];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    mutation.mutate({ slideId, payload: { highlights: next } });
    const previewIndex = ui.previewHighlightIndex;
    if (previewIndex === from) setPreviewHighlightIndex(to);
    else if (previewIndex === to) setPreviewHighlightIndex(from);
  }

  function reorderHighlights(ids: string[], rollback: () => void) {
    const slideId = args.slideId();
    if (!slideId) return;
    const highlights = args.highlights();
    const previewIndex = ui.previewHighlightIndex;
    const previewId = previewIndex >= 0 ? highlights[previewIndex]?.id : undefined;
    const byId = new Map(highlights.map((h) => [h.id, h]));
    const next = ids.map((id) => byId.get(id)).filter((h): h is Highlight => !!h);
    if (next.length !== highlights.length) return rollback();
    mutation.mutate({ slideId, payload: { highlights: next } }, { onError: rollback });
    if (previewId) setPreviewHighlightIndex(next.findIndex((h) => h.id === previewId));
  }

  function previewHighlight(index: number) {
    setPreviewHighlightIndex(ui.previewHighlightIndex === index ? -1 : index);
  }

  function toggleExpanded(id: string) {
    expandedId = expandedId === id ? null : id;
  }

  $effect(() => {
    if (!args.highlightMode()) {
      setPreviewHighlightIndex(-1);
      visible = false;
      pending = null;
    }
  });

  $effect(() => {
    args.slideId();
    setPreviewHighlightIndex(-1);
    expandedId = null;
  });

  return {
    get previewHighlightIndex() {
      return ui.previewHighlightIndex;
    },
    get expandedHighlightId() {
      return expandedId;
    },
    toggleExpanded,
    get contextMenu() {
      return { visible, position };
    },
    closeContextMenu,
    onContextMenu,
    onSelect,
    onMouseUp,
    onKeyUp,
    addPendingHighlight,
    updateHighlight,
    deleteHighlight,
    moveHighlight,
    reorderHighlights,
    previewHighlight,
  };
}

export type HighlightCrudApi = ReturnType<typeof useHighlightCrud>;
