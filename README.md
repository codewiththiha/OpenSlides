# OpenSlides Qwen — Offline-First Code Presentation Studio

> **Desktop-native code presentation editor** built with **Tauri 2 · Rust · SQLite · React 19 · Shiki · Magic Move**. 
> Forked and hardened from [open-slides](https://github.com/codewiththiha/open-slides), rebuilt on [tauri_template](https://github.com/codewiththiha/tauri_template) with a focus on **performance, correctness, and cinematic highlight playback**.

`open-slides-qwen` is the Qwen-branded evolution — same open core, with a roadmap toward AI-assisted slide generation and content aware refactoring powered by Qwen models.

---

## ✨ What is it?

OpenSlides lets you turn **code** into a **presentation**. No screenshots. No copy-paste into slides.com. You write real code, pick a theme, and present it with:

- **Magic Move** morphs between slides (Shiki Magic Move)
- **Spotlight highlights** — dim everything, scale up the 3 lines you actually talk about
- **Per-slide durations, names, transitions**
- **Offline-first** — projects live in SQLite in your OS app-data dir, not in a browser tab

The editor is designed to never lose keystrokes: debounced, serialized, quit-flushed saves + native undo/redo that works even inside WKWebView.

Current checkpoint: `fix: never flash plain text in the editor overlay — sync always-colored highlight` — the editor overlay *always* shows colored code, even before the async Shiki highlighter resolves.

---

## 🚀 Feature Highlights

### Editor Core
- **Tauri 2 frameless window** with custom TitleBar
- **Resizable panels** (`react-resizable-panels`) — preview & code & slide strip all resizable, auto-collapse when dragged below threshold, restore last size on expand
- **Virtualized slide strip** (`@tanstack/react-virtual`) + **dnd-kit** drag-to-reorder with rollback on IPC failure
- **Uncontrolled textarea** architecture to avoid WKWebView caret teleport — char-width cache + Rust measurement fallback
- **Debounced autosave (500ms)** serialized per slide (`src/lib/code-save-queue.ts`) — out-of-order IPC can never regress DB
- **Quit handshake** — Rust intercepts `CloseRequested` / `ExitRequested`, emits `app://quit-request`, frontend flushes pending save, then `finish_quit` lets the app exit. Hard-exit fallback after 4s so quit never hangs.
- **Native undo/redo** — browser undo stack, not custom OT; `⌘/Ctrl+Z` works deterministically
- **Command Palette** (`⌘K`) — new project, add slide, present, zen, settings, theme toggle
- **Zen mode** — hides chrome, focuses on preview+editor
- **True fullscreen present** — tries `requestFullscreen` on `#openslides-present-root`, falls back to Tauri `setFullscreen(true)`, handles `Esc` / OS exit sync

### Preview & Presentation
- **Shiki singleton** (`src/lib/shiki-instance.ts`) — one highlighter instance, themes preloaded, Merlin?
- **Shiki Magic Move** for beautiful token-level morphs across slides
- **16 themes**: `dark-plus`, `dracula`, `github-dark/light`, `nord`, `poimandres`, `min-light/dark`, `monokai`, `solarized-dark/light`, `andromeeda`, `aurora-x`, `catppuccin-latte/mocha`, `night-owl`
- **Code align**: `left` or `center` (block centered, not text-align)
- **Auto-play**: advance per-slide `duration` (min 500ms), stops at deck end
- **Arrow keys** navigate slides in normal mode
- **Global top bar** shows slide name, inline rename, save badge (idle/saving/saved/error)
- **Export/Import JSON** via `tauri-plugin-dialog` — native save/open dialogs

### Highlight System (Sub-Slide Spotlights)
The crown jewel. Each slide can have N highlights.

Flow per step:
```
User selects → context menu → new Highlight { startLine, startChar, endLine, endChar, dimAmount, sizeUp, transitions }
      ↓
step change → getTokenLines (Rust Merustmar OR JS Shiki line tokens)
      ↓
buildPlan (JS pure: src/lib/highlight-tokens.ts — per-line char ranges + token slicing + HTML-escaped clone + eraser color)
      ↓
measureHighlight (JS: Range API → pixel rects)
      ↓
Layer: dim overlay (opacity = dimAmount) + per-line eraser boxes (background = eraserColor, mixed in Rust) + scaled clone (framer-motion)
```

Why this design?
- **Slicing happens on raw token strings**, HTML escaping at render — so `<`, `&`, `"` never cause half-entity cuts
- **Empty middle lines** in multi-line selections are handled explicitly
- **Eraser color** = dimmed card background, mixed in Rust to avoid flicker — box is invisible, only glyphs underneath disappear
- **Crossfade** — when stepping A→B, dim persists (animates to B's dim), A's eraser+clone exit while B's enter
- **Outro honors real durations** — `useHighlightNav` waits for `AnimatePresence onExitComplete` before advancing slide; fail-safe timer capped at 3200ms if preview unmounts mid-outro
- **Adjustable size-up**: 100% = no scale, 105-300% pop, default 125%, custom per-highlight intro/outro durations

### Persistence
- **SQLite via sqlx (runtime-only, no macros)** — avoids macOS release build corruption (`mis-aligned LINKEDIT string pool`)
- **WAL + Normal sync + busy_timeout 5s** — 5-connection pool, reads never block on debounced writes
- **Migrations**: `schema_version` table, imperative steps
  - v1: hoist per-slide `language` into project settings (source of truth)
  - v2: `slides.name` + `codeAlign` default
  - v3: `slides.highlights` JSON column

Schema:
```sql
projects(id TEXT PK, name TEXT, theme TEXT DEFAULT 'dark-plus', settings TEXT JSON, created_at INTEGER, updated_at INTEGER)
slides(id TEXT PK, project_id FK CASCADE, order_index INTEGER, code TEXT, language TEXT DEFAULT 'typescript', 
       transition_duration INTEGER 750, stagger INTEGER 5, duration INTEGER 3000, name TEXT DEFAULT '', highlights TEXT DEFAULT '[]')
CREATE INDEX idx_slides_project ON slides(project_id, order_index);
```

### Special Languages
- **Merustmar** — custom Myanmar-inspired programming language. Two implementations:
  - **Frontend frozen**: `src/lib/merustmar-language.ts` (Shiki grammar) + `src/lib/merustmar-highlight.ts` (JS fallback) — **DO NOT EDIT** per policy
  - **Backend Rust port**: `src-tauri/src/merustmar.rs` — byte-exact port including quirks (UTF-16 indexing, unanchored regex emulation, surrogate handling), proven by parity fixtures `src-tauri/tests/fixtures/merustmar/parity.json`
- Supported list: TypeScript, JavaScript, TSX, JSX, Python, Java, Go, Rust, PHP, CSS, HTML, JSON, YAML, SQL, Bash, Markdown, Merustmar

---

## 🧱 Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Desktop shell | **Tauri 2** | Rust backend, webview frontend, frameless window, opener/dialog plugins |
| Backend | **Rust / Tokio / sqlx** | Commands in `src-tauri/src/commands/`, WAL SQLite, JSON merge for settings |
| Frontend | **React 19 + Vite 7 + TypeScript 5.8** | Strict mode, React Router, path alias `@` |
| Styling | **Tailwind 4 + @tailwindcss/vite** | Dark/light CSS variables, shiki-magic-move CSS |
| State | **Zustand 5 + persist middleware** | UI-only: `currentSlideId`, zen, panels, `localCode` shadow, saveStatus, previewHighlightIndex |
| Data fetching | **TanStack Query 5** | Cache + optimistic merges over Tauri IPC, `mergeSlidePreservingEditorCode` to avoid stale code stamp |
| Drag & DnD | **dnd-kit** | Sortable slide strip |
| Animation | **framer-motion 12** | Highlight intro/outro/crossfade, spring scale |
| Highlighting | **Shiki 3 + shiki-magic-move 1** | Singleton highlighter, WASM onig |
| Icons | **lucide-react** | |
| Panels | **react-resizable-panels 3** | Collapsible with size memory |
| Virtualization | **@tanstack/react-virtual** | Slide strip |
| UI primitives | **Radix UI** | Dialog, dropdown, slider, tooltip, etc. + cva, sonner toasts (fixed 400x72px) |
| Tests | **node:test + jsdom** | Highlight token unit tests, save-race tests, Rust parity |

---

## 📁 Project Structure

```
.
├── src-tauri/
│   ├── Cargo.toml              # Rust deps (tauri 2, sqlx runtime, tokio, serde, uuid, chrono)
│   ├── tauri.conf.json         # App id, window config (center:true, titleBarStyle:Visible, CSP null), bundle icons
│   ├── build.rs
│   ├── capabilities/default.json
│   ├── icons/
│   └── src/
│       ├── lib.rs              # run() — setup DB pool, register commands, quit flush handshake (CloseRequested + ExitRequested)
│       ├── main.rs
│       ├── db.rs               # init_db, WAL pragmas, run_migrations (v1-v3)
│       ├── models.rs           # Project, Slide, Highlight, Settings structs (camelCase serde)
│       ├── merustmar.rs        # Byte-exact Rust port of frozen Merustmar highlighter (UTF-16, alt-match)
│       └── commands/
│           ├── mod.rs          # Re-exports
│           ├── helpers.rs      # now_ms, DEFAULT_CODE, fetch_project, load/save settings
│           ├── projects.rs     # get_projects, get_project, create/rename/delete, update_settings/theme
│           ├── slides.rs       # create/delete/restore/update_code/update_settings/reorder/set_current
│           ├── io.rs           # export_project_to_json / import_project_from_json (native dialogs + serde_json)
│           ├── merustmar.rs    # merustmar_tokens command — token lines (content + color)
│           └── quit.rs         # finish_quit — sets QUIT_FLUSHED atomic
├── src/
│   ├── main.tsx                # QueryClient, installAppMenu, quit-request listener, flush on beforeunload, App
│   ├── App.tsx                 # BrowserRouter /editor/:projectId ↔ Dashboard
│   ├── index.css               # Tailwind + shiki-magic-move + fixed toast system + scrollbar + resize handle hitareas
│   ├── vite-env.d.ts
│   ├── types.ts                # Project, Slide, Highlight, ThemeName, SUPPORTED_LANGUAGES, resolveProjectLanguage, themeBackground
│   ├── store/useUiStore.ts     # Zustand persisted (localStorage key openslides-ui), applyUiTheme side-effect
│   ├── lib/
│   │   ├── tauri-api.ts        # invoke wrappers: typed Project/Slide/Highlight DTOs
│   │   ├── shiki-instance.ts   # getHighlighter singleton, theme load
│   │   ├── merustmar-language.ts # FROZEN Shiki LanguageRegistration for Merustmar
│   │   ├── merustmar-highlight.ts # FROZEN JS fallback highlighter (client-side)
│   │   ├── highlight-tokens.ts # Pure JS token slicing: plainTokenLines, sliceSnippets, buildPlan, selectionToRange, TokenLine types
│   │   ├── highlight-utils.ts  # measureHighlight (DOM Range → rects), createDefaultHighlight, char width cache
│   │   ├── code-save-queue.ts  # Per-slide promise queue — serialized saves
│   │   ├── save-flush.ts       # flushPendingSave for quit handshake
│   │   ├── app-menu.ts         # installAppMenu — native menu handlers
│   │   ├── keyboard.ts         # isModKey, isTypingTarget
│   │   ├── platform.ts         # modKeyLabel (⌘ vs Ctrl)
│   │   ├── toast.ts            # notify.success/error/info, fixed-size sonner wrapper
│   │   └── utils.ts            # cn (clsx+tailwind-merge)
│   ├── hooks/
│   │   ├── useAppMenu.ts       # Bridge menu:// events to callbacks
│   │   ├── useCollapsiblePanel.ts # Panel ref + collapseThreshold → store sync
│   │   ├── useHighlightNav.ts  # highlightIndex, goNext/goPrev, isAdvancing, pending nav + fail-safe + onExitComplete
│   │   ├── useHighlightPlan.ts # Async tokenLines + buildPlan, id-tracking to avoid flash of previous step
│   │   └── queries/
│   │       ├── keys.ts         # projectKeys.all/detail
│   │       ├── projects.ts     # useProjects, useProject, useCreateProject, useDelete, rename, updateSettings/Theme, export/import
│   │       ├── slides.ts       # useUpdateSlideCode (enqueueCodeSave), useUpdateSlideSettings, create/delete/restore/reorder, mergeSlidePreservingEditorCode
│   │       └── highlights.ts   # useHighlightSnippets — react-query sliceSnippets
│   └── components/
│       ├── TitleBar.tsx        # Frameless window controls, draggable region
│       ├── Dashboard.tsx       # Project grid, create, rename inline, delete with confirm, import
│       ├── Editor.tsx          # Main workspace: TitleBar + present overlay + 2 PanelGroups (code/preview + slides), save badge, autoplay, fullscreen, menu handlers, slide name inline edit
│       ├── CodeEditor.tsx      # Uncontrolled textarea + always-colored sync overlay (Shiki sync or Merustmar sync or plain escaped), highlight mode toggle, context menu → add highlight, line numbers, undo/redo events (openslides:undo)
│       ├── SlidePreview.tsx    # Shiki Magic Move render + HighlightLayer ref, theme bg, fontSize/lineHeight, codeAlign
│       ├── HighlightLayer.tsx  # framer-motion AnimatePresence: dim + erasers + clone, ResizeObserver coalesced to rAF, measure on 280ms settle
│       ├── BottomSlidesPanel.tsx # Virtualized strip, DndContext, inline rename, delete, duration
│       ├── HighlightSettingsPanel.tsx # List of highlights, dim/sizeUp sliders, custom transition, playable
│       ├── HighlightContextMenu.tsx   # Right-click menu in highlight mode
│       ├── HighlightStepIndicator.tsx # Dots / step counter
│       ├── SettingsDrawer.tsx  # Project settings: language, fontSize, lineHeight, global transition/stagger, theme
│       ├── CommandPalette.tsx  # cmdk palette, dark/light aware
│       ├── ShortcutsHelp.tsx   # Help dialog
│       └── ui/                 # button, card, input, label, slider, switch, toaster, tooltip
├── tests/
│   ├── highlight-tokens.test.mts     # Unit tests for token slicing
│   ├── highlight-utils-cache.test.mts
│   ├── codeeditor-typing.test.mts
│   ├── editor-save-race.test.mts     # Race-condition guard for save queue
│   ├── helpers/jsdom-env.mts
│   ├── mocks/...
│   └── shiki-e2e.check.mjs
├── scripts/
│   ├── run-highlight-tests.mjs
│   └── run-save-race-tests.mjs
├── vite.config.ts              # @ alias, host TAURI_DEV_HOST, watcher ignore src-tauri
├── tsconfig.json / tsconfig.node.json
├── index.html
└── package.json                # Scripts: dev, build, preview, tauri, test:highlight, test:save-race
```

---

## 🔄 Data Flow

### Project Open
```
Dashboard mount → useProjects (api.getProjects) → SQLite SELECT summaries
Click → /editor/:id → useProject (api.getProject) → Rust fetch_project (projects+slides join, settings JSON parse, highlights JSON parse)
          → Zustand currentSlideId init from settings.currentSlideId ?? first slide
          → localCode {} empty
```

### Typing / Saving
```
Textarea input → set localCodeRef + setLocalCode in store (optimistic, no re-render of whole tree due to useShallow)
             → debounced 500ms → enqueueCodeSave(slideId, code)
                 → ensures per-slide FIFO: previous promise chain → invoke("update_slide_code")
                 → Rust UPDATE slides SET code WHERE id
                 → touch_project updated_at
                 → onSuccess: setQueriesData projects cache with new code + clearLocalCode if shadow matches
```

Critical invariant: `mergeSlidePreservingEditorCode` — settings responses never stamp stale `code` into cache; only the code channel owns `code`.

### Theme + Settings
```
SettingsDrawer → useUpdateSettings (patch JSON) → invoke("update_project_settings")
→ Rust merge_settings: serde_json::to_value(existing) + patch_obj insert (skip theme) → parse + TO_JSON + UPDATE projects.settings
→ updated_at bump (except set_current_slide)
```

### Present + Highlights
```
Enter Present → setIsPresenting true → effect tryEnterFullscreen (requestFullscreen → fallback window.setFullscreen)
ArrowRight / click → useHighlightNav.goNext()
  - if more highlights: set highlightIndex++
  - else: if not last slide → arm fail-safe (dim+size transition + 250ms, capped 3200ms), set highlightIndex -1, pending advance
          → HighlightLayer sees highlight=null → plays outro → AnimatePresence onExitComplete → finishPending → setCurrentSlideId(next)
AutoPlay: setTimeout(duration min 500) → goNext(), if returns false (deck finished) → setIsAutoPlaying false
```

---

## 🎨 Highlight Plan Internals (Indexed)

- **Types** (`highlight-tokens.ts`):
  - `HighlightTokenLine[]` = `MerustmarToken[][]` or Shiki `codeToTokensBase` equivalent
  - `SelectionRange { startLine, startChar, endLine, endChar }`
  - `HighlightPlan { lines: PlanLine[], eraserColor: string, ranges: ... }`
  - `PlanLine { lineIndex, startChar, endChar, html: escaped token slice }`

- **buildPlan**: input raw `code + tokenLines + range + themeBg + dimAmount` → output plan
  - Splits token strings by char offsets (UTF-16 aware? JS native, Rust merustmar mirrors)
  - Escapes HTML at render time
  - Computes eraserColor = dimmed theme background (Rust mixing logic reused)
  - Handles empty middle lines: if selection spans lines, middle lines are fully included even if they are empty

- **measureHighlight**: container + codeRoot + plan + fontSize/lineHeight → `HighlightMeasurement { segments: { line, rect {x,y,w,h} }[], union }`
  - Uses `document.createRange()` per line slice
  - Retry loop 12 rAF if refs null (commit ordering)
  - ResizeObserver coalesced to 1 rAF

- **Why never flash plain text**: `CodeEditor.tsx` computes `syncOverlay = shikiSync ?? merustmarSync` synchronously from already-loaded highlighter (or frozen JS highlighter). No async fallback to plain text. The async `useEffect runHighlight` then enhances, but colored overlay is always present from first paint. Previous version flashed `plainEscaped` before Shiki resolved.

---

## 🛠️ Develop

### Prerequisites
- Node 20+
- Rust stable (1.80+)
- Platform WebView deps: see [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)
  - macOS: Xcode CLI tools
  - Linux: webkit2gtk, libayatana-appindicator, etc.
  - Windows: WebView2

### Install & Run
```bash
npm install
# Frontend only (IPC mocks fail — OK for CSS/layout work)
npm run dev

# Full desktop app (recommended)
npm run tauri dev

# Production bundle
npm run tauri build
```

### Tests
```bash
# Highlight token pure-logic regression (no deps, node:test)
npm run test:highlight

# Save-queue race regression
npm run test:save-race

# Rust unit + parity
cd src-tauri
cargo test

# Or single file
cargo test merustmar -- --nocapture
```

### Lint / Format
- TypeScript strict mode via `tsc && vite build`
- Rust `cargo fmt` + `cargo clippy` recommended

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘/Ctrl+K` | Command palette |
| `⌘/Ctrl+B` | Zen mode |
| `⌘/Ctrl+Shift+F` | Present |
| `→ / ←` | Next / Prev highlight step, then slide |
| `Esc` | Exit present / close dialogs |
| `⌘/Ctrl+Z` | Undo (native) |
| `⌘/Ctrl+Shift+Z` | Redo |
| `?` | Shortcuts help |

---

## 🧠 Design Decisions & Gotchas

- **No localStorage for persistence** — only UI prefs in `openslides-ui` Zustand persist; projects/slides/highlights live exclusively in SQLite.
- **Zustand selector**: `useShallow` to avoid re-rendering whole editor on keystroke.
- **No TanStack virtual flicker**: slide strip virtualizer keyed by stable ids.
- **Shiki Singleton**: `shiki-instance.ts` prevents duplicate WASM loads; hot-reload safe.
- **Why Rust Merustmar?** Offloads tokenization off WebView main thread, IPC runtime, single source of truth shape for highlight plan.
- **Quit flush**: beforeunload + Tauri CloseRequested/ExitRequested both trigger flushPendingSave; Rust side guarantees exit in 4s even if frontend wedged.
- **CodeEditor uncontrolled**: `defaultValue` + ref mirror avoids React controlled textarea caret reset in WKWebView.
- **Theme background helper**: `themeBackground()` in types.ts maps theme name → solid hex for eraser color + preview card.

---

## 🔮 Roadmap — Qwen Variant

- [ ] Qwen API integration: generate slide deck from prompt (`Create a Rust intro deck with 10 slides`)
- [ ] Code explain + translate: select range → Qwen explains in sidebar
- [ ] Smart highlight suggestions: LLM proposes important lines per slide
- [ ] Export to video (per-slide screencast + narration TTS)
- [ ] Collaborative CRDT sync (Tauri + WebTransport)
- [ ] Plugin system for custom languages via WASM TextMate

---

## 🤝 Contributing

1. Fork, clone, `npm install`
2. Branch from `main` (`feat/...` / `fix/...`)
3. Ensure `npm run test:highlight` + `cargo test` pass
4. PR, describe highlight/slide model changes if any

Mark Merustmar frozen files untouched.

---

## 📄 License

MIT — same spirit as original web version.

---

*Built with ❤️ by codewiththiha — now offline, faster, and Qwen-ready.*

