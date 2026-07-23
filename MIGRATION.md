# React 19 → Svelte 5 Migration

Complete rewrite of the frontend from React 19 to Svelte 5 (runes mode).
`src-tauri/` is untouched; all Tauri commands, the SQLite layer, and the
native menu protocol are identical.

## Library mapping

| React (before)                         | Svelte 5 (after)                                    |
| -------------------------------------- | --------------------------------------------------- |
| react, react-dom                       | svelte                                              |
| zustand (+ persist, slices, selectors) | `$state` runes (`src/store/ui-state.svelte.ts`)     |
| @tanstack/react-query                  | @tanstack/svelte-query (singleton client, explicit) |
| react-router-dom (HashRouter)          | svelte-spa-router (hash-based, same URLs)           |
| @dnd-kit/*                             | svelte-dnd-action + custom pointer DnD (dashboard)  |
| framer-motion                          | svelte/transition + svelte/motion (Spring/Tween)    |
| @radix-ui/*                            | bits-ui                                             |
| cmdk                                   | bits-ui Command (cmdk-sv's official successor)      |
| sonner                                 | svelte-sonner                                       |
| lucide-react                           | @lucide/svelte                                      |
| react-resizable-panels                 | paneforge                                           |
| @tanstack/react-virtual                | @tanstack/svelte-virtual (Readable store)           |
| use-debounce                           | `$effect` + `setTimeout` (editor saves, search)     |
| clsx + tailwind-merge, CVA, shiki,     | unchanged                                           |
| workers, Tailwind v4                   |                                                     |

## Structure

- `src/main.ts` — Svelte `mount()`, dark-class bootstrap, quit-save flush.
- `src/App.svelte` — routes `/`, `/editor/:projectId`, `*` (redirect).
- `src/store/ui-state.svelte.ts` — the app store; persisted slice keeps the
  exact zustand-persist localStorage wire format (`{ state, version }`).
- `src/queries/` — TanStack query/mutation hooks (was `src/hooks/queries/`).
- `*.svelte.ts` — rune modules (hooks/services). Plain `.ts` files must NOT
  use runes (the Svelte compiler only transforms `.svelte` / `.svelte.*`).
- Component tree mirrors the old one 1:1 (`src/components/**`).

## Notable behavioural parity decisions

- **CodeEditor textarea is uncontrolled** (value written once at mount /
  slide switch by `useCodeEditorCaret`). The old controlled round-trip (cache
  stamp → value assignment → caret teleport) cannot recur; the regression
  suites (`tests/editor-save-race`, `tests/codeeditor-typing`) mount the real
  component in jsdom and assert it end-to-end.
- Drag-and-drop: slide rail uses svelte-dnd-action; dashboard project grid
  uses a custom pointer-DnD manager (`src/lib/project-dnd.svelte.ts`)
  reproducing dnd-kit's 8 px threshold + rect-collision semantics, including
  drops through the StackSpread backdrop.
- Outro/exit animations that React coordinated via AnimatePresence are driven
  by `|global` transitions + explicit exit-complete signals (see
  `useHighlightNav`, `HighlightLayer`).
- framer springs retuned to equivalent unit-mass Svelte spring constants;
  durations converted seconds → ms.
- Command menus use bits-ui's `Command` namespace (cmdk-sv pulled in a
  Svelte-4-only @melt-ui peer): items mark selection with a presence-only
  `data-selected` attribute (was `data-selected=true`), groups use a
  `GroupHeading` child instead of a `heading` prop, and items without
  text-derived values get an explicit lowercase `value` for filtering.
- bits-ui v2 Slider has no `Track` subcomponent (plain span inside the
  Root's children snippet; `Thumb` requires `index`).
- paneforge `expand()` takes no size argument (unlike
  react-resizable-panels): expand + resize instead.
- @lucide/svelte icons are standard Svelte 5 components (the deprecated
  `lucide-svelte` package shipped legacy class components).

## Tests

Run with: `npm run test:highlight`, `npm run test:save-race`,
`npm run test:app-flow`.

The React/jsdom suites were ported to mount real Svelte components:
`scripts/lib/esbuild-svelte.mjs` precompiles `.svelte` and `.svelte.ts`
modules for esbuild; `tests/harness/*` mirrors the app wiring
(`EditorInner` → live query cache → `CodeEditor`). 27 tests, all passing.

The app-flow suite (`npm run test:app-flow`) mounts the REAL `App.svelte`
(hash router + Dashboard + EditorInner) against a full in-memory
`tauri-api` mock and drives the complete user journey — dashboard card
click → editor → Present → stage clicks stepping highlights → slide
advance → exit. It caught a genuine post-migration freeze:

- **Dashboard effect loop (fixed).** `ProjectGridView` synced row options
  via `$effect(() => { $rowVirtualizer.setOptions(...) })`. svelte-virtual's
  `setOptions` ends with an unconditional store notification, and Svelte
  stores always treat object values as changed — so the tracked `$store`
  read made the effect re-run forever until the
  `effect_update_depth_exceeded` guard fired, wedging the dashboard (cards
  unclickable). The instance is now read non-reactively with
  `get(rowVirtualizer)`; only `rowCount` is tracked.
- **Care-taking after unmount (fixed).** `saveCaret` read a slide-id
  derived that could already belong to the destroyed editor branch; it now
  bails out on a detached textarea first.

## Verification

- `npx svelte-check --tsconfig ./tsconfig.json` → **0 errors, 0 warnings**.
  The deliberate initial-value captures (project-scoped hook factories,
  `$state`/Spring/Tween initializers that re-sync via effects) are marked
  with `untrack(() => …)`; interactive elements carry proper roles/keys
  (`StackDeck` keeps its conditional button semantics behind one scoped
  `svelte-ignore` for the conditional `tabindex`).
- `npm run build` → clean.
- `npm run test:highlight` → 13/13; `npm run test:save-race` → 14/14;
  `npm run test:app-flow` → 4/4.
