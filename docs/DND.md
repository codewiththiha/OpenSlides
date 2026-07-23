# Drag & drop

Two deliberately different DnD systems exist; don't mix them.

## 1. Dashboard project drag (custom pointer engine)

`features/dashboard/project-dnd.svelte.ts`

- Pointer-capture sessions with an 8px start threshold; payloads are
  `project-cell` (a grid cell / whole stack) or `fan-item` (one project
  pulled from an open fan).
- Hover targets are DOM rects (`data-chunk-id` cells); hit testing is
  rAF-throttled during pointermove and finalized synchronously on
  pointerup. `setProjectDropHandler` lets `ProjectGrid` own the drop
  decision (stack onto target, or unstack a fan item dragged >120px away).
- The dragged visual is a **non-interactive static clone** rendered
  through `use:portal` at the pointer (ProjectCard `static` prop).
- Drag is CSS-only for hover feedback (ring/scale via `dnd` session
  state) — no element is actually moved until the mutation lands and the
  query cache updates the grid.

## 2. Slide strip drag (svelte-dnd-action + custom stack logic)

`features/slides/dnd/` — controller `slide-dnd.svelte.ts` keeps reactive
state and DOM wiring; pure logic lives next to it:

- `stack-hover-geometry.ts` — `findStackHoverId` with hysteresis
  (enter at 16%/12% overlap, exit at 5%/4%) so hover doesn't flicker at
  boundaries.
- `pointer-insertion.ts` — pointer-position → insertion index math,
  `pointerShadowReorder` producing the shadow ordering or `null`.
- `dnd-finalize.ts` — `decideFinalize`: given start/end, did we reorder,
  stack, unstack, or do nothing?
- `dnd-types.ts` — shared geometry/payload types.

The strip (`features/slides/strip/`) renders drop affordances from this
state: `data-stack-target` overlays are pure visual feedback and never
intercept pointer events (hit testing is the controller's pointer
tracker, not element events). Targets include single cards, collapsed
stack decks and fanned-out stack sections; `stack-targeting` tests
(4 cases) pin the geometry.

`stacking` helpers shared by both systems live in
`shared/lib/stacking.svelte.ts` (`autoDissolveStacks`, fan layout in
`stacking.ts`), and the queries side (stack/unstack mutations) is
`shared/queries/stacks.ts`.

## Keyboard alternative

Both systems have pointer-free paths: project stacks dissolve via the
spread's "Ungroup all"; slides reorder via context menu and selection
toolbar batch actions.
