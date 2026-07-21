import { useCallback } from "react";
import { type Snapshot } from "@/lib/editor-history";

const TAB_SPACES = "  ";

interface UseCodeEditorTabKeyArgs {
  slideId: string | undefined;
  handleChange: (value: string, beforeOverride?: Snapshot) => void;
}

export function useCodeEditorTabKey({
  slideId,
  handleChange,
}: UseCodeEditorTabKeyArgs) {
  /**
   * Handle Tab / Shift+Tab indentation.
   * Caller must have already checked `e.key === "Tab"` and `slideId`.
   * The event target must be the textarea element.
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

      if (e.shiftKey) {
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        const before = value.slice(0, lineStart);
        let line = value.slice(lineStart);
        let removed = 0;
        if (line.startsWith(TAB_SPACES)) {
          line = line.slice(TAB_SPACES.length);
          removed = TAB_SPACES.length;
        } else if (line.startsWith("\t")) {
          line = line.slice(1);
          removed = 1;
        }
        const next = before + line;
        // Synchronous value + caret update in same microtask (no rAF flash)
        el.value = next;
        const pos = Math.max(lineStart, start - removed);
        try {
          el.selectionStart = el.selectionEnd = pos;
        } catch {}
        handleChange(next, beforeSnapshot);
        return;
      }

      const next = value.slice(0, start) + TAB_SPACES + value.slice(end);
      // Synchronous update guarantees caret positioning happens in exact same microtask as value update
      el.value = next;
      const pos = start + TAB_SPACES.length;
      try {
        el.selectionStart = el.selectionEnd = pos;
      } catch {}
      handleChange(next, beforeSnapshot);
    },
    [slideId, handleChange],
  );

  return handleTabKey;
}
