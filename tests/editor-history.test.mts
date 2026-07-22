import test from "node:test";
import assert from "node:assert/strict";
import { record, redo, undo, type Snapshot } from "../src/lib/editor-history";

test("redo restores the actual post-edit caret snapshot", () => {
  const slideId = `history-caret-${Date.now()}`;
  const before: Snapshot = { code: "hello", caretStart: 2, caretEnd: 2 };
  const after: Snapshot = { code: "heXllo", caretStart: 3, caretEnd: 3 };

  record(slideId, before, after);

  assert.deepEqual(undo(slideId), before);
  assert.deepEqual(redo(slideId), after);
});

test("redo preserves a post-edit selection range", () => {
  const slideId = `history-selection-${Date.now()}`;
  const before: Snapshot = { code: "alpha", caretStart: 1, caretEnd: 4 };
  const after: Snapshot = { code: "aZ", caretStart: 2, caretEnd: 2 };

  record(slideId, before, after);

  assert.deepEqual(undo(slideId), before);
  assert.deepEqual(redo(slideId), after);
});
