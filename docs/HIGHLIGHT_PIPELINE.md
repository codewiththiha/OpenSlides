# Highlight pipeline

How "highlight these lines/characters with a dim/spotlight effect" renders.

## Syntax highlighting (Shiki)

- One Shiki highlighter per (theme, language) display, created off the UI
  thread by `shared/shiki/shiki.worker.ts`; `worker-client.ts` talks to it
  (`isTestEnv()` swaps to an in-process fallback for node tests).
- Display state machines live in `shared/shiki/` as a facade
  `shiki-display.svelte.ts` over three modules:
  - `shiki-policies.ts` — retention policies per consumer
    (`resolvePolicy`, `ShikiDisplayPolicyName`),
  - `shiki-html-display.svelte.ts` — plain HTML displays
    (`shikiDisplayHtml`, `editorShikiHtml`),
  - `shiki-highlighter-display.svelte.ts` — the magic-move display used by
    `SlidePreview` (`magicMoveShikiDisplay`).
- Consumers: CodeEditor (editor pre layer), SlidePreview (magic move),
  slide thumbnails (`slide-thumbnail.svelte.ts`), dashboard cards
  (ProjectThumb), theme/create tiles.
- `extract-html.ts` normalizes worker and fallback output to the inner
  `<code>` markup so both paths agree.

## Tokens → spans

`features/highlights/highlight-tokens.ts` is the pure, fully tested core:

- `decompose` — turns a highlight's line start/end + char precision
  ranges into per-line token slices,
- `sliceTokenLine` — clips a tokenized line to a range,
- `renderTokensToSpans` — emits span metadata with colors resolved from
  the Shiki palette.

Tests (`test:highlight`, 11 cases) import these directly.

## CRUD and interaction

- `highlight-crud.svelte.ts` (`createHighlightCrud`) — add/remove/toggle
  highlights from CodeMirror selections; keeps `ui.previewHighlightIndex`
  in sync; the strip context menu and editor menu call into it.
- `highlight-measurement.svelte.ts` + `highlight-plan.svelte.ts` — map
  highlight ranges to rendered line rects and compute per-frame dim plans.
- `highlight-nav.svelte.ts` — next/previous-step navigation for
  presentation autoplay.
- `HighlightLayer.svelte` — overlaid span layer on the preview;
  `HighlightSettingsForm` previews edits instantly through the
  `ui.previewHighlights` shadow (`previewMergedHighlights`, see STATE.md).
- `HighlightContextMenu.svelte` — right-click actions
  (`role="menu" aria-label="Highlight actions"`).

## Presentation

During presentation the same layer drives the "everything dims except the
active highlight" step reveal; `HighlightStepIndicator` shows progress and
`PresentOverlay`/`PreviewPane` pass `activeHighlightIndex` down.

- Step changes are **sequential**: a click plays the current highlight's
  outro fully (dim held, clone scales down + fades) and only then the next
  highlight's intro — never a crossfade. `createHighlightNav` parks
  `highlightIndex` at -1 with the next step queued in `pending`;
  `nav.spotlightActive` is threaded down so only the dim overlay survives
  the gap (`HighlightLayer` also caches the last highlight so a held dim
  keeps its custom amount/duration).
- There are **no painted panels over the code** (the old eraser boxes /
  `mixTowardBlack` read as black slabs and were deleted). Instead
  `createHighlightUnderlay` fades the ORIGINAL token spans of the
  selection to opacity 0 in sync with the dim (`dimMs` + EASE_DIM), using
  the same cached line text nodes the measurer uses — so only the bright
  clone shows in that spot, and the originals fade back in on step
  change/removal.
- The last highlight's outro plays fully before the slide advances (the
  layer's exit-complete signal drives the advance, with the fail-safe
  timer as backstop).
