# OpenSlides Qwen — Codebase Index

Generated: 2026-07-20

## Repository snapshot

- **Purpose:** Offline-first desktop code-presentation editor.
- **Architecture:** React 19 + TypeScript/Vite frontend, Tauri 2/Rust desktop backend, SQLite persistence.
- **Entry points:** `src/main.tsx` (frontend), `src-tauri/src/main.rs` and `src-tauri/src/lib.rs` (desktop).
- **Current branch:** `main`.
- **Scope indexed:** 105 tracked files, approximately 19,091 lines including Rust, TypeScript, tests, configuration, and fixtures. Binary app icons are tracked but excluded from line totals.

## System map

```text
React UI
  ├─ Dashboard / Editor routes
  ├─ CodeEditor (uncontrolled textarea + colored overlay)
  ├─ SlidePreview (Shiki + Magic Move)
  ├─ HighlightLayer (spotlight dim/eraser/scale animation)
  └─ Zustand UI state + TanStack Query data cache
          │
          └─ src/lib/tauri-api.ts → Tauri invoke IPC
                                      │
Rust/Tauri commands
  ├─ projects.rs — project CRUD/settings/import/export
  ├─ slides.rs — slide CRUD/code/settings/reorder
  ├─ io.rs — file/dialog and JSON I/O
  ├─ quit.rs — coordinated quit handshake
  └─ merustmar.rs — custom-language tokenization
          │
          └─ db.rs/models.rs → SQLite (WAL, migrations, serialized JSON fields)
```

## Directory index

### Frontend (`src/`)

- `App.tsx`, `main.tsx`: application shell, providers and routes.
- `components/`: user-facing UI. `Editor.tsx` composes the workspace; `Dashboard.tsx` handles projects; `BottomSlidesPanel.tsx` handles virtualized drag/reorder; `CodeEditor.tsx` handles typing, overlay highlighting, selection and highlight creation; `SlidePreview.tsx` and `HighlightLayer.tsx` render presentation output.
- `components/editor/`: editor layout, toolbar and presentation overlay decomposition.
- `components/ui/`: Radix/Tailwind-based reusable controls.
- `hooks/queries/`: TanStack Query hooks for projects, slides and highlights; contains optimistic/cache merge logic.
- `hooks/`: keyboard handling, panel collapse, highlight navigation/planning, fullscreen and Shiki worker lifecycle.
- `lib/`: IPC adapter, serialized code-save queue, token/highlight planning, Shiki singleton, language definitions, keyboard/platform utilities and toast helpers.
- `store/`: Zustand UI preferences and local editor-code shadow state.
- `workers/`: background Shiki tokenization worker.
- `types.ts`: shared domain types and theme/background helpers.
- `index.css`: global theme variables and application styling.

### Backend (`src-tauri/`)

- `src/lib.rs`: Tauri builder, plugin registration, command registration, quit event handling.
- `src/db.rs`: SQLite connection setup, WAL/busy-timeout configuration and imperative schema migrations.
- `src/models.rs`: serializable project/slide/settings/highlight models.
- `src/commands/projects.rs`: project queries and mutations.
- `src/commands/slides.rs`: slide queries, code/settings updates, ordering and highlight persistence.
- `src/commands/io.rs`: import/export and native file dialog operations.
- `src/commands/helpers.rs`: shared validation/conversion/database helpers.
- `src/commands/quit.rs`: finish-quit command.
- `src/merustmar.rs`: backend implementation of the frozen Merustmar tokenizer.
- `tests/fixtures/merustmar/parity.json`: frontend/backend parity cases.
- `tauri.conf.json`, `capabilities/default.json`: desktop packaging/window/security configuration.

### Tests and scripts

- `tests/highlight-tokens.test.mts`: pure token slicing/escaping/range behavior.
- `tests/highlight-utils-cache.test.mts`: highlight utility caching behavior.
- `tests/codeeditor-typing.test.mts`: uncontrolled editor typing and overlay behavior.
- `tests/editor-save-race.test.mts`: serialized save queue and stale-write protection.
- `tests/shiki-e2e.check.mjs`: Shiki integration smoke check.
- `scripts/run-highlight-tests.mjs`, `scripts/run-save-race-tests.mjs`: dependency-light test runners.
- Rust tests are run from `src-tauri` with `cargo test` and include Merustmar parity coverage.

## Runtime data flow

1. Dashboard loads project summaries through TanStack Query → Tauri IPC → SQLite.
2. Opening a project fetches project settings and ordered slides; Zustand initializes the active slide.
3. Typing updates local editor state immediately, then enters a 500 ms debounced per-slide FIFO save queue.
4. Query-cache merge logic preserves unsaved local code from stale settings responses.
5. Preview tokenizes code through the Shiki singleton/worker; Merustmar uses its frozen JS grammar or Rust fallback.
6. Present mode advances highlights first, then slides; outro completion or a bounded fallback timer advances the deck.
7. Quit events trigger frontend save flushing before Rust permits exit, with a hard timeout safety path.

## Important invariants / policies

- Keep `src/lib/merustmar-language.ts` and its related frozen frontend implementation unchanged unless parity is intentionally updated.
- Do not use browser localStorage for project persistence; SQLite is the source of truth.
- Code editor remains uncontrolled to preserve WebView caret and native undo behavior.
- Code saves are serialized per slide; out-of-order IPC responses must not regress persisted or cached code.
- Highlight ranges are sliced from raw token strings and HTML-escaped only during rendering.
- Tauri commands and models must keep frontend IPC payload shapes synchronized.

## Tooling and verification

- Node 20+, Rust stable 1.80+ recommended.
- `npm run build`: TypeScript check plus Vite production build.
- `npm run test:highlight`: highlight/token regression suite.
- `npm run test:save-race`: save queue regression suite.
- `cd src-tauri && cargo test`: backend and Merustmar parity tests.
- `cargo fmt` and `cargo clippy` are recommended Rust checks.

## Initial observations

- README documents the architecture and design invariants in detail and is broadly aligned with the current tree.
- The project has focused regression coverage around the highest-risk editor paths: token slicing, Shiki caching, typing/caret behavior, and save races.
- The main integration boundary is the Tauri IPC layer; changes to Rust commands should be checked against `src/lib/tauri-api.ts`, query hooks, and model types together.
- Native desktop builds depend on platform WebView prerequisites and may not be runnable in a headless Linux environment; frontend checks and Rust unit tests remain useful CI gates.
