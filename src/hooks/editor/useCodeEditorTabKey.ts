import { useCallback } from "react";
import { type Snapshot } from "@/lib/editor-history";

const TAB_SPACES = "  ";

interface UseCodeEditorTabKeyArgs {
  slideId: string | undefined;
  handleChange: (value: string, beforeOverride?: Snapshot) => void;
}

function removeIndent(line: string): { line: string; removed: number } {
  if (line.startsWith(TAB_SPACES)) return { line: line.slice(TAB_SPACES.length), removed: TAB_SPACES.length };
  if (line.startsWith("\t")) return { line: line.slice(1), removed: 1 };
  return { line, removed: 0 };
}

export function useCodeEditorTabKey({
  slideId,
  handleChange,
}: UseCodeEditorTabKeyArgs) {
  /**
   * Handle Tab / Shift+Tab indentation. Multi-line selections operate on every
   * selected line; a single-line selection keeps the normal insert behavior.
   */
  const handleTabKey = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!slideId) return;
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const value = el.value;
      const beforeSnapshot: Snapshot = { code: value, caretStart: start, caretEnd: end };
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      // A selection ending exactly at a line boundary should not include the
      // following unselected line.
      const effectiveEnd = end > start && value[end - 1] === "\n" ? end - 1 : end;
      const endLineStart = value.lastIndexOf("\n", effectiveEnd - 1) + 1;
      const isMultiline = end > start && endLineStart > lineStart;

      if (isMultiline) {
        const endLineEndIndex = value.indexOf("\n", effectiveEnd);
        const lineEnd = endLineEndIndex < 0 ? value.length : endLineEndIndex;
        const before = value.slice(0, lineStart);
        const selectedLines = value.slice(lineStart, lineEnd).split("\n");
        const after = value.slice(lineEnd);

        if (e.shiftKey) {
          const adjusted = selectedLines.map(removeIndent);
          const next = before + adjusted.map((item) => item.line).join("\n") + after;
          const removedBeforeStart = Math.min(adjusted[0]?.removed ?? 0, start - lineStart);
          const totalRemoved = adjusted.reduce((sum, item) => sum + item.removed, 0);
          const nextStart = Math.max(lineStart, start - removedBeforeStart);
          const nextEnd = Math.max(nextStart, end - totalRemoved);
          el.value = next;
          try {
            el.selectionStart = nextStart;
            el.selectionEnd = nextEnd;
          } catch {}
          handleChange(next, beforeSnapshot);
          return;
        }

        const next = before + selectedLines.map((line) => TAB_SPACES + line).join("\n") + after;
        const nextStart = start + TAB_SPACES.length;
        const nextEnd = end + TAB_SPACES.length * selectedLines.length;
        el.value = next;
        try {
          el.selectionStart = nextStart;
          el.selectionEnd = nextEnd;
        } catch {}
        handleChange(next, beforeSnapshot);
        return;
      }

      if (e.shiftKey) {
        const before = value.slice(0, lineStart);
        const { line, removed } = removeIndent(value.slice(lineStart));
        const next = before + line;
        const pos = Math.max(lineStart, start - removed);
        el.value = next;
        try {
          el.selectionStart = el.selectionEnd = pos;
        } catch {}
        handleChange(next, beforeSnapshot);
        return;
      }

      const next = value.slice(0, start) + TAB_SPACES + value.slice(end);
      const pos = start + TAB_SPACES.length;
      el.value = next;
      try {
        el.selectionStart = el.selectionEnd = pos;
      } catch {}
      handleChange(next, beforeSnapshot);
    },
    [slideId, handleChange],
  );

  return handleTabKey;
}
