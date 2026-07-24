# OpenSlides

**Beautiful code presentations for content creators, educators, and developers.**

OpenSlides is a free, open-source, offline desktop app for turning code into polished slides with smooth, step-by-step transitions. It is a direct alternative to [codeslides.app](https://codeslides.app): create expressive code decks, keep your work on your own machine, and present without a subscription or internet connection.

## Made for explaining code beautifully

Whether you are recording a tutorial, teaching a class, streaming a live build, giving a conference talk, or sharing a technical demo, OpenSlides helps you focus attention on the exact part of the code that matters.

- Turn source code into presentation-ready slides.
- Reveal an idea line by line with highlight steps.
- Move between code states with smooth Magic Move transitions.
- Keep projects private, local, and ready to present anywhere.
- Build a visual story around your code instead of showing a static editor.

## What you can do

- Create, organize, rename, duplicate, import, and export slide projects.
- Arrange slides in stacks and reorder them with drag and drop.
- Apply syntax highlighting and choose light or dark presentation themes.
- Create stepped highlights and control their emphasis: dim amount, size-up scale, and custom transition timings per highlight.
- Search across slides, use thumbnails and hover previews, and navigate by keyboard.
- Present in full screen with optional autoplay and per-slide timing.
- Keep working confidently with local projects, saved layouts, and per-slide undo/redo.

## How it works

Create a project, add your code to slides, then select the lines you want to explain. OpenSlides turns those selections into presentation steps, so you can guide viewers through a function, refactor, algorithm, or feature at a natural pace. When it is time to present, move through slides and highlight steps with the keyboard, use full-screen mode, or let the deck advance automatically.

Everything stays on your computer. That makes OpenSlides useful for private client work, offline classrooms, live events, and any workflow where you want your code and slides under your control.

## Download

Prebuilt installers for macOS, Windows, and Linux are available from the [OpenSlides Releases](https://github.com/codewiththiha/OpenSlides/releases) page.

### Platform packages

- **macOS:** Apple Silicon, Intel, and Universal builds
- **Windows:** x64 and ARM64 builds
- **Linux:** `.deb` and `.rpm` packages

### Linux installation

OpenSlides release builds include Linux packages in `.deb` and `.rpm` formats.

- **Debian / Ubuntu / Linux Mint / Pop!\_OS**

```bash
sudo apt install ./OpenSlides_<version>_amd64.deb
```

- **Fedora / RHEL / Rocky / AlmaLinux / openSUSE**

```bash
sudo rpm -i OpenSlides-<version>-1.x86_64.rpm
```

If your distribution prefers a different workflow, read the package manager guidance in your distro docs first. AppImage is intentionally not documented yet.

## Tech stack

- **Desktop app:** Tauri 2 and Rust
- **Interface:** Svelte 5 (runes), TypeScript, Vite 7, and Tailwind CSS 4
- **Component toolkit:** bits-ui, paneforge, and @lucide/svelte
- **Data and flow:** @tanstack/svelte-query, svelte-spa-router, and persistent rune stores
- **Motion and DnD:** Svelte transitions/springs, svelte-dnd-action, and custom pointer drag-and-drop
- **Code rendering:** Shiki and shiki-magic-move
- **Local storage:** SQLite (via sqlx, Rust side)

## Run from source

### Requirements

- Node.js 20 or newer
- Rust stable toolchain and Cargo
- Platform requirements for Tauri 2

```bash
npm install
npm run tauri dev
```

To run the interface in a browser:

```bash
npm run dev
```

### Development checks

The same gates CI enforces on every push and pull request:

```bash
npm run check              # svelte-check: 0 errors, 0 warnings
npm run lint               # eslint
npm run format:check       # prettier (svelte + tailwind plugins)
npm run test:highlight     # highlight token pipeline (11 tests)
npm run test:save-race     # editor save/debounce races (14 tests)
npm run test:app-flow      # real app flows in jsdom: dashboard -> editor -> present (9 tests)
npm run test:stack-targeting  # slide stack drop-zone geometry (4 tests)
npm run build              # production bundle
```

## License

MIT — see [LICENSE](LICENSE).
