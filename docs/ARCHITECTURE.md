# Architecture

OpenSlides is a Tauri 2 desktop app. The frontend is **Svelte 5 (runes)** +
TypeScript + Tailwind 4; the backend is Rust (`src-tauri/`). State is split
between TanStack Query (server/backend data) and small rune modules (UI
state). The app is a hash-router SPA — there is no SvelteKit.

## Layers

```
src/app/       bootstrap + shell (main.ts, App.svelte, routes.ts)
src/features/  one folder per screen/domain, may compose shared/
src/shared/    layer-zero modules: ui primitives, stores, queries, lib, types
```

Aliases: `$lib/*` → `src/shared/*`, `@/*` → `src/*` (vite + tsconfig +
test esbuild runners all agree).

Direction is enforced by ESLint:

```
app ─▶ features ─▶ shared
```

`shared/` may not import from `features/` or `app/`; `features/` may not
import from `app/` (`no-restricted-imports` in `eslint.config.js`).

## Feature map

| Feature        | Contents                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `dashboard`    | Project grid, stack fan (StackSpread), drag-to-stack (`project-dnd`), card actions context                                                  |
| `editor`       | Editor shell, CodeMirror wrapper `CodeEditor.svelte` + `code-editor/` controllers (apply/find/keyboard/highlighting/slide-nav), PreviewPane |
| `preview`      | `SlidePreview` + MagicMove renderer (`magicMoveShikiDisplay`)                                                                               |
| `slides`       | Slide strip (`strip/`), card + actions context, current-slide, slide DnD (`dnd/`)                                                           |
| `highlights`   | Highlight CRUD (`highlight-crud`), token pipeline, measurement/plan/nav, context menu                                                       |
| `presentation` | Fullscreen overlay, autoplay, controls                                                                                                      |
| `settings`     | Settings drawer, effective/preview settings, theme pickers                                                                                  |

## Shared map

- `shared/ui/` — design-system primitives (Button, Card, Overlay, dialogs,
  HoverActions, transitions, stack deck, code-card theme).
- `shared/components/` — app-shell components (TitleBar, CommandPalette,
  ShortcutsHelp).
- `shared/stores/` — rune state modules (`ui-state.svelte.ts`,
  `slide-code.svelte.ts`, `ui-persistence.ts`). See `STATE.md`.
- `shared/queries/` — TanStack factories: `query-client.ts` (singleton +
  MutationCache invalidation policy), `mutation-policy.ts`
  (`projectListMutation`/`slideMutation`), `projects.ts`, `slides.ts`,
  `stacks.ts`, `keys.ts`. The singleton client is passed explicitly, so no
  `QueryClientProvider` is needed.
- `shared/lib/` — framework-free helpers: `tauri-api.ts` (invoke wrapper +
  `CommandError` normalization), `code-save.ts` (per-slide save chains),
  `app-events.ts`, `app-menu.svelte.ts`, `logger.ts`, `toast.ts`,
  `themes.ts`/`theme-meta.ts`, `stacking.svelte.ts`, `grouping.ts`…
- `shared/shiki/` — Shiki singleton, web worker (`shiki.worker.ts` +
  `worker-client.ts`), display state machines (`shiki-display.svelte.ts`
  facade over policies/html/highlighter), `slide-thumbnail`, `extract-html`.
- `shared/actions/` — DOM actions (`focus-trap`, `click-outside`,
  `escape-key`, `autofocus`, `portal`).
- `shared/types/` — domain types (`Project`, `Slide`, `Highlight`,
  settings, `ThemeName`).

## Naming conventions (ESLint-enforced)

- **No `useX` names** — that is React vocabulary. Factories are `createX`,
  queries `xQuery`, mutations `xMutation`, context pairs
  `provideX`/`consumeX`, otherwise plain utilities.
- No `any` (`@typescript-eslint/no-explicit-any` is an error).
- `import type` everywhere types-only (`consistent-type-imports`).
- Mutate `ui` only through its setters (`no-restricted-syntax`, see
  `STATE.md`).

## Bootstrap & routing

`main.ts` hydrates the persisted theme (`initInitialTheme`), installs the
native menu, wires the quit handshake (`app://quit-request` →
`flushPendingSave()` → `finish_quit`, Rust force-exits after ~4s), then
mounts `App.svelte`. `routes.ts` maps dashboard `/` and editor
`/editor/:id` via `svelte-spa-router`.

## Backend boundary

All IPC goes through `shared/lib/tauri-api.ts`, which exposes typed `api.*`
functions wrapping `invoke` and normalizing backend errors into
`CommandError` (`code: "CANCELLED" | "ERROR"`). Structured error shapes are
validated; JSON payloads for import are validated Rust-side.

## Verification gate

Every change must keep these green: `svelte-check` (0 errors/warnings),
`npm run lint`, the four node:test suites (35 tests: stack-targeting,
highlight, save-race, app-flow), and `npm run build`. CI
(`.github/workflows/ci.yml`) runs the same gate; `knip.json` keeps dead
code at zero.
