# State

Three kinds of state exist, on purpose:

1. **Backend data** — TanStack Query (`shared/queries/`). Projects, slides
   and stacks live in the query cache; `MutationCache` invalidates the
   dashboard list from mutation metadata (`invalidateProjectList`), so
   per-mutation `onSuccess` invalidation boilerplate does not exist.
2. **UI/session state** — rune modules under `shared/stores/`.
3. **Local/parent state** — `$state` in components and `createX`
   factories passed down as props or context.

## UI store (`shared/stores/ui-state.svelte.ts`)

One `$state` object `ui` (current slide, panel sizes/collapse, presentation
flags, dialog visibility, theme, save status, preview indexes) plus
**setter functions** (`setCurrentSlideId`, `setIsCommandOpen`,
`setCodePanelSize`, `toggleTheme`, …).

Discipline (§7.2, ESLint-enforced): components never write `ui.x = ...`
directly — every write goes through a setter, and the setters are the only
place that may assign. Reads (`ui.currentSlideId`) are fine anywhere.

## Editor code shadow (`shared/stores/slide-code.svelte.ts`)

`localCode: Record<slideId, string>` is the live-typing shadow; it exists
so typing doesn't round-trip through the query cache each keystroke.
`effectiveSlideCode(slide)` resolves `localCode[id] ?? slide.code`.
`setLocalCode/clearLocalCode/getLocalCode` are the API. Property-level
reactivity means a card only re-renders when its own id changes.
See `SAVE_PIPELINE.md` for how this flushes.

## Instant preview overrides

`ui.previewProject` / `ui.previewSlides` / `ui.previewHighlights` let the
settings UI preview changes _before_ committing them (dragging a font-size
slider updates the preview live). Helpers live in
`features/settings/preview-settings.ts` (`previewProjectSetting`,
`previewHighlightSettings`, `previewMergedHighlights`) and
`features/settings/effective-settings.svelte.ts` merges project → slide
→ preview into one effective settings object.

## Persistence (`shared/stores/ui-persistence.ts`)

Selected UI prefs (theme, panel sizes, editor options…) persist to
localStorage under `UI_STORAGE_KEY`; `initInitialTheme()` hydrates before
first paint in `main.ts`. The wire format is owned here and nowhere else.

## Context actions

Two action channels replace long prop chains (guide §2.1):

- `features/dashboard/project-card-actions.svelte.ts` — provided by
  `Dashboard.svelte`; `ProjectCard` consumes open/duplicate/export/remove +
  rename state. `StackSpread` re-provides a scoped override that closes the
  fan before opening a project.
- `features/slides/slide-card-actions.svelte.ts` — provided by
  `SlideStripExpanded`; `SlideCard`/`SlideCardHeader`/`SlideCardActions`
  consume rename/remove/duplicate/multi-select/context-menu.

Both are getter-backed (`readonly` fields read live state) and provided
exactly once with `untrack` + late-binding closures. Per-card _data_
(slide, selection flags, tab stop) stays in props; only stable _actions_
travel by context.

## App events (`shared/lib/app-events.ts`)

Cross-feature signals that are not state: `emitOpenSearch`/`onOpenSearch`
(slide search dialog) and `emitFindInCode`/`onFindInCode` (CodeMirror
find bar) wrap Tauri/DOM event channels behind typed helpers.
