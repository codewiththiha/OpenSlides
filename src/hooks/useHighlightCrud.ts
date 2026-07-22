import { useCallback, useEffect, useState } from "react";
import { useUiStore } from "@/store/useUiStore";
import { useUpdateSlideSettings } from "@/hooks/queries";
import { selectionToRange } from "@/lib/highlight-tokens";
import { createDefaultHighlight } from "@/lib/highlight-factory"
import type { Highlight } from "@/types";

export function useHighlightCrud({
  projectId, slideId, highlights, code, highlightMode, textareaRef, saveCaret,
}: {
  projectId: string;
  slideId: string | undefined;
  highlights: Highlight[];
  code: string;
  highlightMode: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  saveCaret: () => void;
}) {
  const mutation = useUpdateSlideSettings(projectId);
  const previewIndex = useUiStore((s) => s.previewHighlightIndex);
  const setPreviewIndex = useUiStore((s) => s.setPreviewHighlightIndex);

  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [pending, setPending] = useState<{ startLine: number; startChar: number; endLine: number; endChar: number } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const closeContextMenu = useCallback(() => setVisible(false), []);
  const showAt = useCallback((x: number, y: number) => {
    if (!highlightMode || !textareaRef.current) return;
    const { selectionStart, selectionEnd } = textareaRef.current;
    if (selectionStart === selectionEnd) return;
    setPending(selectionToRange(code, selectionStart, selectionEnd));
    setPosition({ x: Math.min(Math.max(8, x), Math.max(8, window.innerWidth - 188)), y: Math.min(Math.max(8, y - 84), Math.max(8, window.innerHeight - 92)) });
    setVisible(true);
  }, [highlightMode, code, textareaRef]);
  const onContextMenu = useCallback((e: React.MouseEvent) => { if (!highlightMode) return; e.preventDefault(); showAt(e.clientX, e.clientY); }, [highlightMode, showAt]);
  const onSelect = useCallback(() => { saveCaret(); if (textareaRef.current?.selectionStart === textareaRef.current?.selectionEnd) setVisible(false); }, [saveCaret, textareaRef]);
  const onMouseUp = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => { saveCaret(); if (e.button === 0 && highlightMode && textareaRef.current?.selectionStart !== textareaRef.current?.selectionEnd) showAt(e.clientX, e.clientY); }, [saveCaret, highlightMode, showAt, textareaRef]);
  const onKeyUp = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => { saveCaret(); if (!e.shiftKey || !highlightMode || visible || !textareaRef.current || textareaRef.current.selectionStart === textareaRef.current.selectionEnd) return; const r = textareaRef.current.getBoundingClientRect(); showAt(r.left + r.width / 2 - 90, r.top + 8); }, [saveCaret, highlightMode, visible, showAt, textareaRef]);
  const addPendingHighlight = useCallback(() => { if (!pending || !slideId) return; const hl = createDefaultHighlight(pending.startLine, pending.startChar, pending.endLine, pending.endChar); mutation.mutate({ slideId, payload: { highlights: [...highlights, hl] } }); setPending(null); setExpandedId(hl.id); }, [pending, slideId, highlights, mutation]);
  const updateHighlight = useCallback((id: string, patch: Partial<Highlight>) => { if (!slideId) return; mutation.mutate({ slideId, payload: { highlights: highlights.map((h) => h.id === id ? { ...h, ...patch } : h) } }); }, [slideId, highlights, mutation]);
  const deleteHighlight = useCallback((id: string) => { if (!slideId) return; const index = highlights.findIndex((h) => h.id === id); mutation.mutate({ slideId, payload: { highlights: highlights.filter((h) => h.id !== id) } }); if (expandedId === id) setExpandedId(null); if (index >= 0) { if (previewIndex === index) setPreviewIndex(-1); else if (previewIndex > index) setPreviewIndex(previewIndex - 1); } }, [slideId, highlights, mutation, expandedId, previewIndex, setPreviewIndex]);
  const moveHighlight = useCallback((id: string, dir: -1 | 1) => { if (!slideId) return; const from = highlights.findIndex((h) => h.id === id), to = from + dir; if (from < 0 || to < 0 || to >= highlights.length) return; const next = [...highlights]; const [item] = next.splice(from, 1); next.splice(to, 0, item); mutation.mutate({ slideId, payload: { highlights: next } }); if (previewIndex === from) setPreviewIndex(to); else if (previewIndex === to) setPreviewIndex(from); }, [slideId, highlights, mutation, previewIndex, setPreviewIndex]);
  const reorderHighlights = useCallback((ids: string[], rollback: () => void) => { if (!slideId) return; const previewId = previewIndex >= 0 ? highlights[previewIndex]?.id : undefined; const byId = new Map(highlights.map((h) => [h.id, h])); const next = ids.map((id) => byId.get(id)).filter((h): h is Highlight => !!h); if (next.length !== highlights.length) return rollback(); mutation.mutate({ slideId, payload: { highlights: next } }, { onError: rollback }); if (previewId) setPreviewIndex(next.findIndex((h) => h.id === previewId)); }, [slideId, highlights, mutation, previewIndex, setPreviewIndex]);
  const previewHighlight = useCallback((index: number) => setPreviewIndex(previewIndex === index ? -1 : index), [previewIndex, setPreviewIndex]);
  const toggleExpanded = useCallback((id: string) => setExpandedId((prev) => prev === id ? null : id), []);
  useEffect(() => { if (!highlightMode) { setPreviewIndex(-1); setVisible(false); setPending(null); } }, [highlightMode, setPreviewIndex]);
  useEffect(() => { setPreviewIndex(-1); setExpandedId(null); }, [slideId, setPreviewIndex]);
  return { previewHighlightIndex: previewIndex, expandedHighlightId: expandedId, toggleExpanded, contextMenu: { visible, position }, closeContextMenu, onContextMenu, onSelect, onMouseUp, onKeyUp, addPendingHighlight, updateHighlight, deleteHighlight, moveHighlight, reorderHighlights, previewHighlight };
}
