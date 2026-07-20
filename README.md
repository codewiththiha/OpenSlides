# OpenSlides

OpenSlides is an offline-first desktop application for creating and presenting code-focused slide decks.

The application combines a Tauri desktop shell, a React interface, SQLite persistence, Shiki syntax highlighting, and Magic Move transitions. Projects and slides remain local to the application.

## Features

- Create, rename, duplicate, delete, import, and export slide projects.
- Edit code in an uncontrolled textarea designed to preserve caret position during fast slide switching.
- Syntax highlighting through a shared Shiki worker with lazy theme and language loading.
- Custom Merustmar language grammar support.
- Slide previews with Magic Move transitions.
- Highlight steps that dim unrelated code, enlarge selected code, and play in sequence.
- Selection toolbar for creating highlights, with right-click retained as a fallback.
- Drag-and-drop highlight ordering with keyboard arrow-button controls.
- Per-slide undo and redo history that survives slide switches during the session.
- Search across slides using SQLite FTS5 with a browser-side fallback.
- Search snippets with highlighted matches in the slide strip.
- Lazy slide thumbnails with LRU caching, persistent thumbnail HTML, and hover previews.
- Optional slide-card hover previews, disabled by default.
- Keyboard navigation for the slide strip and a Go to Slide dialog.
- Presentation autoplay with per-slide duration, total-duration display, and CSS-animated progress.
- Project and slide settings with session-only undo toasts.
- Resizable editor, preview, and slide panels with persisted panel sizes.
- Light and dark UI themes.
- Local save queue with quit-time flushing for recent edits.
- Local error boundaries around editor and preview rendering.

## Technology

- Tauri 2
- Rust
- Tokio
- SQLite with sqlx
- React 19
- TypeScript
- Vite
- Zustand
- TanStack Query
- dnd-kit
- Shiki
- shiki-magic-move
- Framer Motion
- Tailwind CSS

## Requirements

- Node.js 20 or newer
- Rust stable toolchain
- Cargo
- Platform requirements for Tauri 2

## Development

Install frontend dependencies:

```bash
npm install
```

Start the Tauri development application:

```bash
npm run tauri dev
```

Start only the Vite development server:

```bash
npm run dev
```

Build the frontend:

```bash
npm run build
```

Run the highlight regression tests:

```bash
npm run test:highlight
```

Run the save-race tests:

```bash
npm run test:save-race
```

Check the Rust backend:

```bash
cd src-tauri
cargo check
```

Format the Rust backend:

```bash
cd src-tauri
cargo fmt
```

Run Rust tests:

```bash
cd src-tauri
cargo test
```

## Application Architecture

### Frontend

The React application is organized around the editor workspace, dashboard, presentation overlay, and reusable UI components.

Persistent project data is owned by the Rust and SQLite backend. Zustand stores UI state, preview overrides, panel preferences, and other transient interaction state.

Code editing uses an uncontrolled textarea. The textarea value is updated synchronously when changing slides, and caret positions are stored outside React state so caret saves do not create object-spread update traffic.

The editor uses a shared code-save queue. Edits are serialized per slide, debounced, and flushed before application quit.

### Highlighting

The editor uses one shared Shiki worker client for editor HTML, thumbnails, and other worker-backed highlighting requests. Worker requests use two priorities:

- High priority for active editor rendering and user-requested hover previews.
- Low priority for background slide thumbnails.

The worker loads themes and languages lazily and skips syntax highlighting for unusually large inputs.

Highlight geometry is calculated in TypeScript. A pure-math monospace path is attempted first, followed by a DOM Range fallback. Text nodes and character widths are cached independently.

### Persistence

SQLite uses WAL mode, normal synchronous writes, a busy timeout, and a connection pool. Migrations are imperative and tracked through the `schema_version` table.

Current migrations include:

- Project-wide language settings.
- Slide names and code alignment.
- Highlight JSON data.
- SQLite FTS5 slide search with synchronization triggers.
- Persistent thumbnail HTML.

The thumbnail cache is invalidated when slide code, project language, or project theme changes. Worker write-back checks the current code before storing a thumbnail, preventing stale renders from replacing newer content.

### Search

The slide strip uses a debounced search pipeline:

1. The raw input remains immediate for responsive typing.
2. The effective query is debounced by 180 milliseconds.
3. Rust searches the project-scoped SQLite FTS5 table and returns ranked slide IDs.
4. A JavaScript substring scan is used when the backend is unavailable.
5. Matching cards show a small context snippet with marked text.

The strip keeps filtering separate from optimistic drag order, and drag reordering is disabled while filtered.

### Presentation

Autoplay advances according to each slide duration. Highlight steps consume additional navigation steps before the next slide. The visible progress bar is a CSS transform animation, while the numeric countdown is isolated in a small component.

The presentation overlay uses a separate fullscreen layout and keeps presentation-specific keyboard behavior isolated from editor and dashboard behavior.

## Keyboard Controls

| Keys | Action |
| --- | --- |
| Command or Control plus K | Open the command palette |
| Command or Control plus G | Open Go to Slide |
| Command or Control plus Shift plus F | Focus slide search |
| Slash outside a typing target | Focus slide search |
| Command or Control plus F | Open find and replace |
| Command or Control plus Z | Undo code editing |
| Command or Control plus Shift plus Z | Redo code editing |
| Command or Control plus Y | Redo code editing on Windows and Linux |
| Command or Control plus B | Toggle zen mode |
| Left and Right arrows | Step through highlights or slides when not typing |
| Number keys 1 through 9 | Jump to a highlight step |
| Number key 0 | Return to the clean slide |
| Escape | Close the active dialog or leave zen/presentation mode |

The slide strip supports roving focus. With a card focused, Left and Right move focus, Home and End jump to the edges, Enter or Space selects, Delete removes, and F2 starts renaming.

## Data and Undo Behavior

Code edits use a per-slide in-memory history with coalesced character typing, separate redo stacks, and bounded memory. History is not persisted to SQLite.

Settings changes use single-level session-only undo toasts. Each toast captures the committed value before the latest change and reverts only that change. Undo toasts are dismissed when switching projects.

Project export includes slide names, timing, highlights, language, theme, and project settings. Imports remain compatible with older files that do not contain highlights.

## Error Handling

Editor and preview renderers are isolated by React error boundaries. A renderer failure shows a local recovery panel with a retry action instead of taking down the whole editor workspace.

The quit path has an exactly-once Rust handshake. The first close or quit event emits one frontend flush request and starts one watchdog. Subsequent close events cannot create duplicate requests or watchdog threads.

## Project Information

- Application name: OpenSlides
- Application version: 1.0.0-beta.1
- Rust package: openslides
- Tauri identifier: com.codewiththiha.openslides
- Repository: https://github.com/codewiththiha/OpenSlides

## License

MIT
