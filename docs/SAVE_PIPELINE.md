# Save pipeline

How a keystroke in the code editor becomes a database write.

```
CodeEditor textarea
  └─ createCodeEditorApply (features/editor/code-editor/code-editor-apply.svelte.ts)
       every edit (typing, replace-all, undo/redo, tab indent) goes through applyCode:
         1. recordEditorHistory(slideId, before, after)   per-slide undo history
         2. setLocalCode(slideId, value)                  typing shadow (STATE.md)
         3. markSavePending(slideId, value)               quit-flush bookkeeping
         4. save.schedule(slideId, value)                 500 ms debounce
            └─ createCodeSave (features/editor/save.svelte.ts)
                 SAVE_DEBOUNCE_MS = 500; on fire:
                   updateSlideCodeMutation.mutate
                     └─ enqueueCodeSave (shared/lib/code-save.ts)
                          serialized per slide — Map<slideId, Promise tail>
                          so writes can never land out of order
                           └─ api.updateSlideCode (IPC → Rust)
```

## Ordering guarantees

- **Per-slide serialization** (`tails` map): save N+1 for a slide starts
  only after save N resolves. Different slides save in parallel.
  `pendingSaveChains()` / `pendingSaveChainKeys()` /
  `resetCodeSaveQueue()` are exported for the save-race test suite.
- **Shadow invalidation**: when a save resolves, `updateSlideCodeMutation`
  clears `localCode[slideId]` only if the shadow still equals the saved
  value — newer keystrokes keep the shadow so the editor never jumps back.
- **Quit flush** (`flushPendingSave`): `main.ts` listens for
  `app://quit-request` (Rust intercepts close/Cmd+Q) and
  `beforeunload`; the pending edit is pushed through the same per-slide
  queue so the flush can't overtake an in-flight write. Rust waits ~4s,
  then exits regardless, so quitting can never hang.
- `clearPendingSave(slideId, code)` runs when the debounced write
  succeeds (and only if it refers to the exact pending value).

## Why not save through the query cache?

The query cache round-trips on invalidation; typing at 60 wpm through it
would re-render the whole editor per keystroke. The shadow
(`localCode`) is the single render source while typing, and the cache is
only the "server truth" between sessions. `effectiveSlideCode(slide)`
hides the split from every consumer.

Tests: `npm run test:save-race` (14 tests) characterizes ordering, shadow
transition, and quit-flush behavior with a controllable mock writer.
