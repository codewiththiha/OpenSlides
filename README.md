# OpenSlides (Desktop)

Offline-first **code presentation** desktop app built with **Tauri 2 + Rust + SQLite** and a redesigned **React / Vite / TypeScript** frontend.

Migrated from the web version of [open-slides](https://github.com/codewiththiha/open-slides) onto the [tauri_template](https://github.com/codewiththiha/tauri_template) scaffold.

## Architecture

| Layer | Tech | Responsibility |
|-------|------|----------------|
| UI | React 19, Tailwind 4, Zustand (ephemeral only) | Editor, preview, dashboard |
| Data fetching | TanStack Query | Cache + mutations over Tauri IPC |
| Backend | Tauri 2 commands (Rust) | Business logic, export, dialogs |
| Persistence | SQLite via `sqlx` | Projects + slides in app data dir |
| Highlighting | Shiki (singleton WASM) + Magic Move | Syntax + animated transitions |

### Data flow

```
UI event → optimistic Zustand (localCode / currentSlideId)
        → debounced TanStack mutation
        → invoke("update_slide_code", …)
        → Rust sqlx → SQLite
```

Persistent state **never** goes through `localStorage`. Zustand holds UI-only state (zen mode, presentation, command palette, optimistic code buffer).

## Schema

```sql
projects(id, name, theme, settings JSON, created_at, updated_at)
slides(id, project_id, order_index, code, language, transition_duration, stagger, duration)
```

## Develop

```bash
# Frontend only (mock IPC will fail — use tauri dev)
npm install
npm run dev

# Full desktop app
npm run tauri dev

# Production bundle
npm run tauri build
```

Requires: Node 20+, Rust stable, platform WebView deps (see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)).

## Merustmar language

`src/lib/merustmar-language.ts` and `src/lib/merustmar-highlight.ts` are **frozen** — do not edit. They are loaded via the Shiki singleton.

## Features

- Custom frameless titlebar + window controls
- Resizable preview / editor split (`react-resizable-panels`)
- Virtualized slide strip (`@tanstack/react-virtual`) + dnd-kit reorder
- Debounced auto-save (500 ms) to SQLite
- Command palette (`⌘/Ctrl+K`)
- Zen mode & fullscreen presentation
- Native JSON export via `tauri-plugin-dialog`

## License

MIT (same spirit as the original web app).
